# jmap-serverless

A serverless JMAP (JSON Meta Application Protocol) API implementation using AWS Lambda, API Gateway, and Cognito.

## Prerequisites

Install the following tools:

* **AWS SAM CLI** - [Install the AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
* **Node.js 22** - [Install Node.js 22](https://nodejs.org/en/)
* **Docker** - [Install Docker](https://hub.docker.com/search/?type=edition&offering=community) (for local testing)
* **Terraform** - [Install Terraform](https://developer.hashicorp.com/terraform/downloads)
* **AWS CLI** - [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

## Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure deployment settings** - Edit `config.mk`:
   ```makefile
   REGION = eu-west-2
   ROOT_DOMAIN = your-domain.com
   ```

3. **Set up admin credentials** - Create `.env` file (see `.env.example`):
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```
   
   The `.env` file is gitignored. Your password must meet Cognito requirements:
   - Minimum 8 characters
   - At least one uppercase, one lowercase, and one number

4. **Configure AWS credentials:**
   ```bash
   aws configure sso  # or aws configure
   ```

## Deployment

Deploy the application:
```bash
source .env  # Load admin credentials
make deploy
```

This creates:
- **Cognito User Pool** with admin user (`admin@your-domain.com` by default)
- **API Gateway HTTP API** with Lambda-based authentication
- **Lambda Functions**:
  - GET `/.well-known/jmap` (JMAP discovery endpoint)
  - POST `/jmap` (JMAP RPC endpoint)
  - POST `/auth/logout` (logout endpoint)
- **Route53 DNS** configuration (if applicable)

## Authentication

The application uses AWS Cognito with support for both Basic Authentication (username:password) and Bearer tokens (JWT). Authentication is cookie-based for browsers with automatic token refresh. See [Authentication Documentation](docs/AUTHENTICATION.md) for details.

**Admin User:**
- Created during deployment as `admin@<ROOT_DOMAIN>`
- Password set via `.env` file (must meet Cognito requirements: 8+ chars, uppercase, lowercase, number)

## Local Development

### Build and Test Locally

```bash
sam build
sam local start-api
```

Test the local API:
```bash
curl http://localhost:3000/.well-known/jmap
```

## Testing

Run unit tests:
```bash
npm test
```

## Viewing Logs

```bash
sam logs -n wellKnownJmapFunction --stack-name <stack-name> --tail
```

## Cleanup

Delete the application:
```bash
sam delete --stack-name jmap-serverless
cd infrastructure && terraform destroy
```

**Note:** The User Pool has `DeletionPolicy: Retain` and must be deleted manually from the AWS Console if needed.

## Resources

- [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [JMAP Specification](https://jmap.io/)