# Simple deploy: terraform apply then SAM deploy
#
# User-facing targets you will typically run:
#   - local            : Run backend (SAM) on http://localhost:3001 and frontend (Vite) on http://localhost:5173
#   - local-backend    : Run only the backend locally (SAM API on port 3001)
#   - local-frontend   : Run only the frontend dev server (Vite on port 5173)
#   - deploy           : Deploy everything to AWS (requires config.mk and .env)
#
# Internal helper targets (used by other targets; you generally do not run directly):
#   - tf-apply, sam-deploy, set-admin-password, remove-base-path-mapping, tf-bootstrap, ensure-config

-include config.mk
 -include config.mk
 -include .env
 export ADMIN_USERNAME
 export ADMIN_PASSWORD

TF_DIR      ?= infrastructure
# Derive SAM stack name from samconfig.toml if not provided via env
STACK_NAME  ?= $(shell awk -F'=' '/^stack_name/ {gsub(/[ "\r\t]/, "", $$2); print $$2}' samconfig.toml)

.PHONY: deploy tf-apply sam-deploy set-admin-password remove-base-path-mapping
.PHONY: local local-backend local-frontend

deploy: ensure-config remove-base-path-mapping sam-deploy set-admin-password tf-bootstrap tf-apply

tf-apply:
	@# Read SAM outputs to feed Terraform variables
	REST_API_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`RestApiId`].OutputValue' --output text); \
	REST_API_STAGE=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`RestApiStageName`].OutputValue' --output text); \
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) init -upgrade; \
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) apply \
		-var="region=$(REGION)" \
		-var="root_domain_name=$(ROOT_DOMAIN)" \
		-var="sam_rest_api_id=$$REST_API_ID" \
		-var="sam_rest_api_stage=$$REST_API_STAGE" \
		-auto-approve

sam-deploy:
	@if [ -z "$$ADMIN_PASSWORD" ]; then \
	  echo "ERROR: ADMIN_PASSWORD environment variable is required"; \
	  echo "Set it via: export ADMIN_PASSWORD=yourpass"; \
	  echo "Or create a .env file (already gitignored) containing ADMIN_PASSWORD=..."; \
	  exit 1; \
	fi
	AWS_REGION=$(REGION) sam build
	AWS_REGION=$(REGION) sam deploy --no-confirm-changeset --region $(REGION) \
		--parameter-overrides RootDomainName=$(ROOT_DOMAIN) \
		AdminUsername=$(or $(ADMIN_USERNAME),admin)

remove-base-path-mapping:
	@echo "Checking if base path mapping needs to be updated..."
	@AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) init -upgrade >/dev/null 2>&1; \
	OLD_API_ID=$$(AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) state show aws_api_gateway_base_path_mapping.root 2>/dev/null | grep -E '^\s+api_id\s*=' | awk '{print $$3}' | tr -d '"' || echo ""); \
	if [ -n "$$OLD_API_ID" ]; then \
	  NEW_API_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`RestApiId`].OutputValue' --output text 2>/dev/null || echo ""); \
	  if [ -n "$$NEW_API_ID" ] && [ "$$OLD_API_ID" != "$$NEW_API_ID" ]; then \
	    echo "API Gateway ID changed ($$OLD_API_ID -> $$NEW_API_ID), removing old base path mapping..."; \
	    AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) destroy -target=aws_api_gateway_base_path_mapping.root \
		-var="region=$(REGION)" \
		-var="root_domain_name=$(ROOT_DOMAIN)" \
		-var="sam_rest_api_id=$$OLD_API_ID" \
		-var="sam_rest_api_stage=Prod" \
		-auto-approve >/dev/null 2>&1 && echo "✓ Base path mapping removed" || echo "⚠ Could not remove mapping"; \
	  else \
	    echo "✓ Base path mapping is up-to-date (API ID unchanged)"; \
	  fi; \
	else \
	  echo "No existing base path mapping found in Terraform state"; \
	fi

set-admin-password:
	@if [ -z "$$ADMIN_PASSWORD" ]; then \
	  echo "ERROR: ADMIN_PASSWORD environment variable is required"; \
	  exit 1; \
	fi
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
	if AWS_REGION=$(REGION) aws cognito-idp admin-set-user-password \
		--user-pool-id $$USER_POOL_ID \
		--username $${ADMIN_USER}@$(ROOT_DOMAIN) \
		--password "$$ADMIN_PASSWORD" \
		--region $(REGION) \
		--no-cli-pager 2>/dev/null; then \
	  echo "✓ Admin password set successfully (temporary - user must change on first login)"; \
	else \
	  echo "⚠ Warning: Failed to set password. User may already have a permanent password."; \
	  exit 0; \
	fi

# Bootstrap: ensure hosted zone exists and registrar NS matches Route 53 NS
.PHONY: tf-bootstrap
tf-bootstrap:
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) init -upgrade
	@# Create/refresh the hosted zone first to obtain nameservers
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) apply -auto-approve -target=aws_route53_zone.root -var="region=$(REGION)" -var="root_domain_name=$(ROOT_DOMAIN)" -var="sam_rest_api_id=dummy" -var="sam_rest_api_stage=Prod"
	@# Fetch Route 53 NS from Terraform state
	R53_NS=$$(AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) output -json root_nameservers | jq -r '.[]' | sed 's/\.$//' | sort); \
	REG_NS=$$(dig NS $(ROOT_DOMAIN) +short | sed 's/\.$//' | sort); \
	echo "Route53 NS:\n$$R53_NS"; echo "Registrar NS (public DNS):\n$$REG_NS"; \
	if [ "$$R53_NS" != "$$REG_NS" ]; then \
	  echo "\nACTION REQUIRED: Update your registrar to use the above Route 53 nameservers for $(ROOT_DOMAIN)."; \
	  echo "Re-run 'make deploy' after DNS propagates."; \
	  exit 2; \
	fi

.PHONY: ensure-config
ensure-config:
	@if [ -z "$(REGION)" ] || [ -z "$(ROOT_DOMAIN)" ]; then \
	  echo "ERROR: Set AWS_REGION and ROOT_DOMAIN in config.mk"; exit 1; \
	fi



# Run backend (SAM) and frontend (Vite) locally together
local:
	@command -v sam >/dev/null || (echo "ERROR: AWS SAM CLI not found"; exit 1)
	@docker info >/dev/null 2>&1 || (echo "ERROR: Docker is not running"; exit 1)
	@echo "Building and starting services..."
	@env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE \
	  AWS_REGION=$(or $(REGION),eu-west-2) AWS_DEFAULT_REGION=$(or $(REGION),eu-west-2) \
	  sam build --region $(or $(REGION),eu-west-2)
	@env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE \
	  AWS_REGION=$(or $(REGION),eu-west-2) AWS_DEFAULT_REGION=$(or $(REGION),eu-west-2) \
	  sam local start-api --region $(or $(REGION),eu-west-2) --host 127.0.0.1 --port 3001 \
	  --env-vars env.json \
	  >/dev/null 2>&1 & echo $$! > /tmp/sam-local.pid || exit 1
	@BACK_PID=$$(cat /tmp/sam-local.pid 2>/dev/null); \
	cd web && npm install && npm run dev -- --port 5173 >/dev/null 2>&1 & \
	WEB_PID=$$!; \
	echo $$WEB_PID > /tmp/vite-local.pid; \
	trap "kill $$BACK_PID $$WEB_PID 2>/dev/null; rm -f /tmp/sam-local.pid /tmp/vite-local.pid; exit" INT TERM; \
	echo "Waiting for services to start..."; \
	for i in $$(seq 1 60); do \
		if lsof -ti:3001 >/dev/null 2>&1 && lsof -ti:5173 >/dev/null 2>&1; then \
			echo ""; \
			echo "════════════════════════════════════════════════════════════"; \
			echo "  🚀 Local development servers are running:"; \
			echo "════════════════════════════════════════════════════════════"; \
			echo "  Backend API:  http://localhost:3001"; \
			echo "  Frontend:     http://localhost:5173"; \
			echo "════════════════════════════════════════════════════════════"; \
			echo "  Press Ctrl+C to stop both services."; \
			echo ""; \
			break; \
		fi; \
		if ! kill -0 $$BACK_PID 2>/dev/null || ! kill -0 $$WEB_PID 2>/dev/null; then \
			echo ""; \
			echo "ERROR: One or both services failed to start."; \
			exit 1; \
		fi; \
		sleep 1; \
	done; \
	if ! lsof -ti:3001 >/dev/null 2>&1 || ! lsof -ti:5173 >/dev/null 2>&1; then \
		echo ""; \
		echo "ERROR: Services did not start within 60 seconds."; \
		exit 1; \
	fi; \
	wait $$BACK_PID $$WEB_PID 2>/dev/null || true

# Run only the backend locally
local-backend:
	@command -v sam >/dev/null || (echo "ERROR: AWS SAM CLI not found"; exit 1)
	@docker info >/dev/null 2>&1 || (echo "ERROR: Docker is not running"; exit 1)
	@mkdir -p .logs
	@env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE \
	  AWS_REGION=$(or $(REGION),eu-west-2) AWS_DEFAULT_REGION=$(or $(REGION),eu-west-2) \
	  sam build --region $(or $(REGION),eu-west-2)
	@env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE \
	  AWS_REGION=$(or $(REGION),eu-west-2) AWS_DEFAULT_REGION=$(or $(REGION),eu-west-2) \
	  sam local start-api --region $(or $(REGION),eu-west-2) --host 127.0.0.1 --port 3001 \
	  --env-vars env.json \
	  > ./.logs/sam-local.log 2>&1

# Run only the frontend locally
local-frontend:
	cd web && npm install && npm run dev -- --port 5173

