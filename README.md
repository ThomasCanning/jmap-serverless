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
- **Cognito Hosted UI** for authentication
- **API Gateway** with Cognito authentication
- **Lambda Functions**:
  - GET `/.well-known/jmap` (public)
  - GET `/auth-test` (requires Cognito auth)
- **Route53 DNS** configuration (if applicable)

## Authentication

### Using Cognito Hosted UI

The deployment creates a Cognito Hosted UI for user authentication. After deployment, get the hosted UI URL from CloudFormation outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name $(grep stack_name samconfig.toml | cut -d'"' -f2) \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoHostedUIUrl`].OutputValue' \
  --output text
```

Or view it in the AWS Console under CloudFormation stack outputs.

### First Login (Admin User)

1. Navigate to the **CognitoHostedUIUrl** from stack outputs
2. Log in with:
   - **Username**: `admin@your-domain.com` (or `<ADMIN_USERNAME>@<ROOT_DOMAIN>`)
   - **Password**: The temporary password from your `.env` file
3. Cognito will prompt you to set a new permanent password (this is handled automatically by the hosted UI)
4. After setting your new password, you'll be authenticated and redirected to your callback URL

The hosted UI automatically handles the password change challenge, so no additional code is needed in your application.

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