# JMAP Web Client

Pure React SPA for JMAP servers (RFC 8620 compliant).

## Features

- **Pure frontend** - No server dependencies, completely decoupled from backend
- **Universal** - Works with any RFC 8620 compliant JMAP server
- **Autodiscovery** - Supports RFC 8620 autodiscovery (client follows server redirects)
- **Modern UI** - React + TypeScript + Vite
- **Serverless Deployment** - S3 + CloudFront
- **Multiple Deployment Options** - Deploy at root, subdomain, or different domain

## Architecture

- **Build Tool**: Vite
- **Hosting**: AWS S3 + CloudFront
- **SSL**: AWS Certificate Manager
- **API Calls**: Direct to JMAP server (no proxying)

## Prerequisites

- Node.js 18+
- AWS CLI configured
- Terraform installed
- DNS provider access
- Deployed JMAP server (see [jmap-server](https://github.com/yourname/jmap-server))

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Deployment

```bash
cp config.mk.example config.mk
# Edit config.mk with:
#   - REGION: AWS region
#   - DEPLOYMENT_DOMAIN: Where to host (e.g., jmapbox.com or app.jmapbox.com)
#   - JMAP_API_URL: Your JMAP server URL (e.g., https://jmap.jmapbox.com)
```

### 3. Deploy

```bash
make deploy
```

### 4. Create DNS Records

Follow the DNS setup instructions from terraform output.

**Required:**
1. Certificate validation CNAME (temporary)
2. Domain A or CNAME record pointing to CloudFront

Wait 10-15 minutes for DNS propagation and certificate validation.

### 5. Test

```bash
curl https://your-domain.com
```

## Configuration

### config.mk

Main deployment configuration:

```makefile
REGION = eu-west-2
DEPLOYMENT_DOMAIN = jmapbox.com
JMAP_API_URL = https://jmap.jmapbox.com
```

### .env.production

Runtime configuration (create from `.env.production.example`):

```bash
VITE_API_URL=https://jmap.jmapbox.com
VITE_ENABLE_AUTODISCOVERY=true
```

## Development

Run locally:

```bash
make dev
# Opens at http://localhost:5173
```

The dev server will connect to the JMAP server specified in `config.mk`.

## Deployment Scenarios

### Scenario 1: Same Domain as Server

Deploy web client at root domain where JMAP server is hosted:

```makefile
# Server at: jmap.jmapbox.com
# Client at: jmapbox.com

DEPLOYMENT_DOMAIN = jmapbox.com
JMAP_API_URL = https://jmap.jmapbox.com
```

**Note:** Server handles `jmapbox.com/.well-known/jmap` autodiscovery redirect.

### Scenario 2: Subdomain

Deploy web client at subdomain:

```makefile
# Server at: jmap.jmapbox.com
# Client at: app.jmapbox.com

DEPLOYMENT_DOMAIN = app.jmapbox.com
JMAP_API_URL = https://jmap.jmapbox.com
```

### Scenario 3: Different Domain

Deploy web client at completely different domain:

```makefile
# Server at: jmap.jmapbox.com
# Client at: otherdomain.com

DEPLOYMENT_DOMAIN = otherdomain.com
JMAP_API_URL = https://jmap.jmapbox.com
```

**Important:** Add `https://otherdomain.com` to server's `ALLOWED_ORIGINS`.

### Scenario 4: Multiple Clients

Deploy multiple web clients pointing to same server:

```bash
# Client 1
DEPLOYMENT_DOMAIN=jmapbox.com make deploy

# Client 2 (new repo/directory)
DEPLOYMENT_DOMAIN=second.com make deploy

# Client 3 (new repo/directory)
DEPLOYMENT_DOMAIN=app.third.com make deploy
```

All clients connect to: `https://jmap.jmapbox.com`

Add all domains to server's `ALLOWED_ORIGINS`.

## Autodiscovery

When a user enters `bob@jmapbox.com`:

1. Client extracts domain: `jmapbox.com`
2. Client tries: `https://jmapbox.com/.well-known/jmap`
3. Server returns: `301 redirect to https://jmap.jmapbox.com/.well-known/jmap`
4. Client follows redirect and connects to JMAP API

**The server handles the redirect** - the client just follows it.

## DNS Setup Guide

After deployment, create DNS records at your DNS provider:

### 1. Certificate Validation (Temporary)

```
Name:  <from terraform output>
Type:  CNAME
Value: <from terraform output>
TTL:   300
```

Wait 5-10 minutes for validation, then can be deleted.

### 2. Domain A Record

```
Name:  your-domain.com
Type:  A or ALIAS
Value: <CloudFront domain from terraform output>
TTL:   300
```

**Note:** Some DNS providers require ALIAS records for root domains. Check your provider's documentation.

### 3. Optional: AAAA Record (IPv6)

```
Name:  your-domain.com
Type:  AAAA or ALIAS
Value: <CloudFront domain from terraform output>
TTL:   300
```

## CORS Configuration

The web client makes direct API calls to the JMAP server. Ensure your client domain is in the server's `ALLOWED_ORIGINS`:

**Server config.mk:**
```makefile
ALLOWED_ORIGINS = https://your-client-domain.com,http://localhost:5173
```

Then redeploy the server:
```bash
cd ../jmap-server
make deploy
```

## Build

Build for production:

```bash
make build
```

Output in `dist/` directory.

## Clean

Remove build artifacts:

```bash
make clean
```

## Troubleshooting

### CORS Errors

**Problem:** Browser blocks requests with CORS error.

**Solution:**
1. Verify domain is in server's `ALLOWED_ORIGINS`
2. Redeploy server: `make deploy`
3. Clear browser cache
4. Check CORS headers: `curl -I -H "Origin: https://your-domain.com" https://jmap.server.com/.well-known/jmap`

### Certificate Stuck on "Pending Validation"

**Problem:** Certificate doesn't validate after 15 minutes.

**Solution:**
1. Verify DNS CNAME record is created correctly
2. Check DNS propagation: `dig <validation-record-name>`
3. Wait up to 48 hours (rare)
4. Check terraform output for correct values

### 404 Errors on Refresh

**Problem:** Browser shows 404 when refreshing on a route (e.g., `/inbox`).

**Solution:**
This should be handled automatically by CloudFront custom error responses. If it persists:
1. Verify CloudFront distribution is deployed
2. Wait for CloudFront to propagate (5-10 minutes)
3. Clear browser cache

### API Connection Fails

**Problem:** Client can't connect to JMAP server.

**Solution:**
1. Verify `JMAP_API_URL` in config.mk is correct
2. Check server is deployed and accessible: `curl https://jmap.server.com/.well-known/jmap`
3. Verify CORS settings on server
4. Check browser console for specific error

## Infrastructure Update

To update only infrastructure (without rebuilding):

```bash
cd infrastructure
terraform apply -var="region=<region>" -var="deployment_domain=<domain>"
```

## CloudFront Invalidation

To clear CloudFront cache after deployment:

```bash
DIST_ID=$(cd infrastructure && terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

## Compatible Servers

- [jmap-server](https://github.com/yourname/jmap-server) - Serverless JMAP server
- Any RFC 8620 compliant JMAP server

## Environment Variables

Available Vite environment variables:

- `VITE_API_URL` - JMAP server URL (required)
- `VITE_ENABLE_AUTODISCOVERY` - Enable autodiscovery (optional, default: true)

Set in `.env.production` or pass to build:

```bash
VITE_API_URL=https://jmap.server.com npm run build
```

## Project Structure

```
web/
├── src/               # React application source
├── public/            # Static assets
├── dist/              # Build output (created by npm run build)
├── infrastructure/    # Terraform for S3 + CloudFront
├── config.mk          # Deployment configuration (gitignored)
├── .env.production    # Runtime configuration (gitignored)
└── Makefile           # Build and deployment scripts
```

## Resources

- [JMAP Specification (RFC 8620)](https://jmap.io/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

## License

[Your License]
