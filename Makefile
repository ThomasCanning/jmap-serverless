# Simple deploy: terraform apply then SAM deploy
#
# User-facing targets you will typically run:
#   - local            : Run backend (SAM) on http://localhost:3001 and frontend (Vite) on http://localhost:5173
#   - local-backend    : Run only the backend locally (SAM API on port 3001)
#   - local-frontend   : Run only the frontend dev server (Vite on port 5173)
#   - deploy           : Deploy everything to AWS (requires config.mk and .env)
#
# Internal helper targets (used by other targets; you generally do not run directly):
#   - tf-apply, sam-deploy, set-admin-password, tf-bootstrap, ensure-config

-include config.mk
-include .env
export ADMIN_USERNAME
export ADMIN_PASSWORD

TF_DIR      ?= infrastructure
# Derive SAM stack name from samconfig.toml if not provided via env
STACK_NAME  ?= $(shell awk -F'=' '/^stack_name/ {gsub(/[ "\r\t]/, "", $$2); print $$2}' samconfig.toml)

.PHONY: deploy tf-apply sam-deploy set-admin-password validate-password
.PHONY: local gen-env-local

gen-env-local:
	@STACK_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks --stack-name $(STACK_NAME) --query 'Stacks[0].StackId' --output text 2>/dev/null || true); \
	USER_POOL_CLIENT_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks --stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null || true); \
	REG=$(REGION); API_BASE="http://localhost:3001"; \
	printf '{\n  "wellKnownJmapFunction": {\n    "API_URL": "%s/jmap",\n    "USER_POOL_CLIENT_ID": "%s",\n    "AWS_REGION": "%s"\n  },\n  "jmapFunction": {\n    "USER_POOL_CLIENT_ID": "%s",\n    "AWS_REGION": "%s"\n  },\n  "authTokenFunction": {\n    "USER_POOL_CLIENT_ID": "%s",\n    "AWS_REGION": "%s"\n  },\n  "authLogoutFunction": {}\n}\n' "$$API_BASE" "$$USER_POOL_CLIENT_ID" "$$REG" "$$USER_POOL_CLIENT_ID" "$$REG" "$$USER_POOL_CLIENT_ID" "$$REG" > env.json; \
	echo "✓ Wrote env.json (region=$(REGION), client_id=$${USER_POOL_CLIENT_ID:-<unset>})"

deploy: ensure-config sam-deploy set-admin-password tf-apply

tf-apply:
	@# Read SAM outputs to feed Terraform variables
	HTTP_API_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`HttpApiId`].OutputValue' --output text); \
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) init -upgrade; \
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) apply \
		-var="region=$(REGION)" \
		-var="root_domain_name=$(ROOT_DOMAIN)" \
		-var="sam_http_api_id=$$HTTP_API_ID" \
		-auto-approve

validate-password:
	@if [ -z "$$ADMIN_PASSWORD" ]; then \
	  echo "ERROR: ADMIN_PASSWORD environment variable is required"; \
	  echo "Set it via: export ADMIN_PASSWORD=yourpass"; \
	  echo "Or create a .env file (already gitignored) containing ADMIN_PASSWORD=..."; \
	  exit 1; \
	fi
	@# Check length (minimum 8 characters)
	@if [ $$(printf '%s' "$$ADMIN_PASSWORD" | wc -c | tr -d ' ') -lt 8 ]; then \
	  echo "ERROR: Password must be at least 8 characters"; \
	  exit 1; \
	fi
	@# Check for uppercase letter
	@if ! printf '%s' "$$ADMIN_PASSWORD" | grep -q '[A-Z]'; then \
	  echo "ERROR: Password must contain at least one uppercase letter"; \
	  exit 1; \
	fi
	@# Check for lowercase letter
	@if ! printf '%s' "$$ADMIN_PASSWORD" | grep -q '[a-z]'; then \
	  echo "ERROR: Password must contain at least one lowercase letter"; \
	  exit 1; \
	fi
	@# Check for number
	@if ! printf '%s' "$$ADMIN_PASSWORD" | grep -q '[0-9]'; then \
	  echo "ERROR: Password must contain at least one number"; \
	  exit 1; \
	fi
	@echo "✓ Password meets Cognito requirements"

sam-deploy: validate-password
	AWS_REGION=$(REGION) sam build
	AWS_REGION=$(REGION) sam deploy --no-confirm-changeset --region $(REGION) \
		--parameter-overrides \
			RootDomainName=$(ROOT_DOMAIN) \
			AdminUsername=$(or $(ADMIN_USERNAME),admin) \
			AllowedClientOrigins="$(ALLOWED_ORIGINS)"

set-admin-password: validate-password
	@echo "Setting admin user password..."
	@USER_POOL_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null); \
	if [ -z "$$USER_POOL_ID" ]; then \
	  echo "Warning: User Pool not found. Stack may not be deployed yet."; \
	  exit 0; \
	fi; \
	ADMIN_USER=$${ADMIN_USERNAME:-admin}; \
	echo "Waiting for admin user to be created (max 30 seconds)..."; \
	MAX_RETRIES=6; RETRY=0; \
	while [ $$RETRY -lt $$MAX_RETRIES ]; do \
	  if AWS_REGION=$(REGION) aws cognito-idp admin-get-user \
		--user-pool-id $$USER_POOL_ID \
		--username $${ADMIN_USER}@$(ROOT_DOMAIN) \
		--region $(REGION) >/dev/null 2>&1; then \
	    break; \
	  fi; \
	  RETRY=$$((RETRY + 1)); \
	  echo "  User not found yet, waiting (attempt $$RETRY/$$MAX_RETRIES)..."; \
	  sleep 5; \
	done; \
	USER_STATUS=$$(AWS_REGION=$(REGION) aws cognito-idp admin-get-user \
		--user-pool-id $$USER_POOL_ID \
		--username $${ADMIN_USER}@$(ROOT_DOMAIN) \
		--region $(REGION) --query 'UserStatus' --output text 2>/dev/null); \
	if [ "$$USER_STATUS" = "CONFIRMED" ]; then \
	  echo "✓ Admin user already has a permanent password. Skipping reset."; \
	else \
	  if AWS_REGION=$(REGION) aws cognito-idp admin-set-user-password \
		--user-pool-id $$USER_POOL_ID \
		--username $${ADMIN_USER}@$(ROOT_DOMAIN) \
		--password "$$ADMIN_PASSWORD" \
		--region $(REGION) \
		--permanent \
		--no-cli-pager 2>/dev/null; then \
	    echo "✓ Admin password set (permanent)"; \
	  else \
	    echo "⚠ Warning: Failed to set password."; \
	    exit 0; \
	  fi; \
	fi

.PHONY: ensure-config
ensure-config:
	@if [ -z "$(REGION)" ] || [ -z "$(ROOT_DOMAIN)" ]; then \
	  echo "ERROR: Set AWS_REGION and ROOT_DOMAIN in config.mk"; exit 1; \
	fi



# Run backend (SAM) locally
local:
	@command -v sam >/dev/null || (echo "ERROR: AWS SAM CLI not found"; exit 1)
	@docker info >/dev/null 2>&1 || (echo "ERROR: Docker is not running"; exit 1)
	@$(MAKE) gen-env-local >/dev/null || true
	@mkdir -p .logs
	@env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE \
	  AWS_REGION=$(or $(REGION),eu-west-2) AWS_DEFAULT_REGION=$(or $(REGION),eu-west-2) \
	  sam build --region $(or $(REGION),eu-west-2)
	@echo ""
	@echo "════════════════════════════════════════════════════════════"
	@echo "  🚀 Starting JMAP server locally..."
	@echo "════════════════════════════════════════════════════════════"
	@echo "  Backend API:  http://localhost:3001"
	@echo "  Press Ctrl+C to stop the server."
	@echo ""
	@env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE \
	  AWS_REGION=$(or $(REGION),eu-west-2) AWS_DEFAULT_REGION=$(or $(REGION),eu-west-2) AWS_EC2_METADATA_DISABLED=true \
	  sam local start-api --region $(or $(REGION),eu-west-2) --host 127.0.0.1 --port 3001 \
	  --env-vars env.json

