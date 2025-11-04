# JMAP Server

RFC 8620 compliant JMAP server with autodiscovery support.

## Architecture

- **JMAP API**: `jmap.yourdomain.com` (AWS Lambda + API Gateway)
- **Autodiscovery**: `yourdomain.com/.well-known/jmap` → 301 redirect to API (CloudFront)
- **Authentication**: AWS Cognito (Basic Auth + Bearer tokens)
- **Protocol**: RFC 8620 JMAP Core
- **Infrastructure**: Serverless (AWS SAM + Terraform)

## Features

- ✅ RFC 8620 JMAP Core protocol support
- ✅ HTTP-based autodiscovery (`.well-known/jmap`) and SRV records
- ✅ Multiple authentication methods (Basic, Bearer tokens, refresh tokens)
- ✅ Cookie-based sessions with automatic refresh
- ✅ CORS support for multiple web clients
- ✅ Fully serverless (Lambda + API Gateway)
- ✅ External DNS support (works with any DNS provider)

## Prerequisites

- **AWS SAM CLI** - [Install](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- **Node.js 22+** - [Install](https://nodejs.org/en/)
- **Docker** - [Install](https://hub.docker.com/search/?type=edition&offering=community) (for local testing)
- **Terraform** - [Install](https://developer.hashicorp.com/terraform/downloads)
- **AWS CLI** - [Install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **DNS Provider Access** - Ability to create DNS records

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Deployment

```bash
cp config.mk.example config.mk
# Edit config.mk with:
#   - REGION: Your AWS region
#   - ROOT_DOMAIN: Your domain (e.g., jmapbox.com)
#   - ALLOWED_ORIGINS: Comma-separated list of allowed client origins
```

### 3. Set Admin Credentials

```bash
cp .env.example .env
# Edit .env with:
#   - ADMIN_USERNAME: Admin username (default: admin)
#   - ADMIN_PASSWORD: Strong password (min 8 chars, uppercase, lowercase, number)
```

### 4. Configure AWS

```bash
aws configure sso  # or aws configure
```

### 5. Deploy

```bash
source .env  # Load credentials
make deploy
```

### 6. Create DNS Records

After deployment, terraform will output DNS setup instructions. Create these records at your DNS provider:

**Required DNS Records:**
1. **Certificate Validation** (2 CNAME records, temporary)
2. **JMAP API** (jmap.yourdomain.com → API Gateway)
3. **Autodiscovery** (yourdomain.com → CloudFront)
4. **SRV Record** (_jmap._tcp.yourdomain.com)

See terraform output for exact values.

### 7. Wait & Test

Wait 10-15 minutes for DNS propagation and certificate validation, then test:

```bash
# Test JMAP API
curl https://jmap.yourdomain.com/.well-known/jmap

# Test autodiscovery redirect
curl -I https://yourdomain.com/.well-known/jmap
# Should return: 301 redirect to jmap.yourdomain.com
```

## DNS Setup Guide

This server requires DNS records at your DNS provider (not Route53). After deployment, create:

### 1. ACM Certificate Validation (Temporary)

Create TWO CNAME records for SSL certificate validation:

```
# For JMAP API certificate
Name:  <shown in terraform output>
Type:  CNAME
Value: <shown in terraform output>
TTL:   300

# For root domain certificate
Name:  <shown in terraform output>
Type:  CNAME
Value: <shown in terraform output>
TTL:   300
```

These can be deleted after certificates validate (5-10 minutes).

### 2. JMAP API Subdomain

```
Name:  jmap.yourdomain.com
Type:  CNAME
Value: <API Gateway target from terraform output>
TTL:   300
```

### 3. Root Domain Autodiscovery

```
Name:  yourdomain.com
Type:  A or CNAME
Value: <CloudFront domain from terraform output>
TTL:   300
```

**Note:** Some DNS providers require A records instead of CNAME for root domains. Use an ALIAS record if available, or check your provider's documentation.

### 4. SRV Record (RFC 8620 Autodiscovery)

```
Name:  _jmap._tcp.yourdomain.com
Type:  SRV
Value: 0 1 443 jmap.yourdomain.com.
TTL:   3600
```

**Important:** The trailing dot in the SRV record value is required.

## Client Configuration

This server supports multiple clients (web, desktop, mobile) simultaneously.

### Web Clients

Add client origins to `ALLOWED_ORIGINS` in `config.mk`:

```makefile
ALLOWED_ORIGINS = https://webclient1.com,https://webclient2.com,http://localhost:5173
```

Then redeploy:

```bash
make deploy
```

### Desktop/Mobile Clients

Configure clients to connect directly to:

```
https://jmap.yourdomain.com
```

Or use autodiscovery:
- Email: `user@yourdomain.com`
- Client will autodiscover via SRV or HTTP redirect

## Autodiscovery (RFC 8620)

This server implements both JMAP autodiscovery methods:

### 1. SRV Record (DNS-based)

```
_jmap._tcp.yourdomain.com → jmap.yourdomain.com:443
```

### 2. HTTP Redirect (Well-known URL)

```
https://yourdomain.com/.well-known/jmap
  → 301 redirect to
https://jmap.yourdomain.com/.well-known/jmap
```

Clients can use either method to discover the JMAP server.

## Authentication

The server uses AWS Cognito with three authentication methods:

1. **Basic Auth** - Username/password (RFC 7617)
2. **Bearer Token** - JWT access tokens (RFC 6750)
3. **Refresh Token** - Long-lived tokens for obtaining new access tokens

Cookie-based sessions with automatic refresh are supported for web clients.

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for details.

### Admin User

- Created during deployment: `admin@<ROOT_DOMAIN>`
- Password set via `.env` file
- Password requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number

## Local Development

Run the server locally:

```bash
make local
```

Server runs at: `http://localhost:3001`

Test locally:

```bash
curl http://localhost:3001/.well-known/jmap
```

## Testing

Run unit tests:

```bash
npm test
```

Run specific test:

```bash
npm test -- auth.test.ts
```

## Logs

View Lambda function logs:

```bash
# JMAP session endpoint
sam logs -n wellKnownJmapFunction --stack-name jmap-serverless --tail

# JMAP RPC endpoint
sam logs -n jmapFunction --stack-name jmap-serverless --tail

# Auth endpoints
sam logs -n authTokenFunction --stack-name jmap-serverless --tail
sam logs -n authLogoutFunction --stack-name jmap-serverless --tail
```

Or via AWS Console:
- CloudWatch → Log groups → `/aws/lambda/<function-name>`

## Troubleshooting

### Certificate Validation Stuck

**Problem:** Certificate shows "Pending validation" for >15 minutes.

**Solution:**
1. Check DNS records are created correctly
2. Verify CNAME values match terraform output exactly
3. Wait for DNS propagation (can take up to 48 hours in rare cases)
4. Test DNS: `dig <validation-record-name>`

### 404 on Autodiscovery Endpoint

**Problem:** `https://yourdomain.com/.well-known/jmap` returns 404.

**Solution:**
1. Verify root domain DNS points to CloudFront
2. Wait for DNS propagation (10-15 minutes)
3. Check CloudFront distribution is deployed
4. Test: `curl -I https://yourdomain.com/.well-known/jmap`

### CORS Errors in Web Client

**Problem:** Browser blocks requests with CORS error.

**Solution:**
1. Add client origin to `ALLOWED_ORIGINS` in `config.mk`
2. Redeploy: `make deploy`
3. Clear browser cache
4. Verify CORS headers: `curl -I -H "Origin: https://your-client.com" https://jmap.yourdomain.com/.well-known/jmap`

### Certificate Validation Records

If terraform output doesn't show validation records:

```bash
cd infrastructure
terraform output cert_validation_records
```

Or check AWS Console:
- ACM → Certificates → View certificate → Create records in Route53

## Cleanup

Delete the application:

```bash
# Delete terraform resources
cd infrastructure
terraform destroy -var="region=<region>" -var="root_domain_name=<domain>" -var="sam_http_api_id=dummy"

# Delete SAM stack
sam delete --stack-name jmap-serverless
```

**Note:** The User Pool has `DeletionPolicy: Retain` and must be deleted manually from AWS Console if needed.

Don't forget to remove DNS records from your DNS provider.

## Architecture Details

### Components

- **Lambda Functions** (Node.js 22, ARM64):
  - `wellKnownJmapFunction` - JMAP session endpoint
  - `jmapFunction` - JMAP RPC endpoint
  - `authTokenFunction` - Get access token
  - `authLogoutFunction` - Clear session cookie

- **API Gateway HTTP API**:
  - Custom domain: `jmap.yourdomain.com`
  - CORS configured for allowed origins
  - Rate limiting: 20 req/s, burst 100

- **CloudFront Distribution**:
  - Domain: `yourdomain.com`
  - Handles ONLY `/.well-known/jmap` (autodiscovery redirect)
  - Returns 404 for all other paths

- **ACM Certificates**:
  - API Gateway (regional, in deployment region)
  - CloudFront (us-east-1, required by CloudFront)

- **Cognito User Pool**:
  - User authentication
  - Password policy enforcement
  - JWT token generation

### Cost Estimate

Free Tier (first 12 months):
- Lambda: 1M requests/month free
- API Gateway: 1M requests/month free
- CloudFront: 1TB transfer/month free
- Cognito: 50,000 MAU free

After Free Tier:
- ~$0.01-0.10/month for light usage
- Scales with request volume

## Compatible Clients

- [jmap-web-client](https://github.com/yourname/jmap-web-client) - React web client
- Any RFC 8620 compliant JMAP client

## Resources

- [JMAP Specification (RFC 8620)](https://jmap.io/)
- [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [Authentication Documentation](docs/AUTHENTICATION.md)

## License

[Your License]
