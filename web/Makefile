-include config.mk

TF_DIR ?= infrastructure

.PHONY: build deploy tf-apply ensure-config dev clean

build:
	@echo "Building web client..."
	npm ci
	VITE_API_URL=$(JMAP_API_URL) npm run build
	@echo "✓ Build complete"

deploy: ensure-config build tf-apply
	@echo ""
	@echo "✓ Deployment complete!"
	@echo ""
	@echo "Check terraform output above for DNS setup instructions."

tf-apply:
	@echo "Deploying infrastructure..."
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) init -upgrade
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) apply \
		-var="region=$(REGION)" \
		-var="deployment_domain=$(DEPLOYMENT_DOMAIN)" \
		-auto-approve

ensure-config:
	@if [ -z "$(REGION)" ] || [ -z "$(DEPLOYMENT_DOMAIN)" ] || [ -z "$(JMAP_API_URL)" ]; then \
	  echo "ERROR: Set REGION, DEPLOYMENT_DOMAIN, and JMAP_API_URL in config.mk"; \
	  exit 1; \
	fi
	@if [ ! -f .env.production ]; then \
	  echo "WARNING: .env.production not found. Copy from .env.production.example"; \
	  echo "  cp .env.production.example .env.production"; \
	  echo "  # Edit .env.production with your JMAP server URL"; \
	fi

dev:
	@if [ -z "$(JMAP_API_URL)" ]; then \
	  echo "ERROR: Set JMAP_API_URL in config.mk"; \
	  exit 1; \
	fi
	VITE_API_URL=$(JMAP_API_URL) npm run dev

clean:
	rm -rf dist node_modules

