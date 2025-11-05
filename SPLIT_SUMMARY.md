# Repository Split Implementation Summary

## Overview

Successfully split the monolithic jmap-server repository into two completely decoupled repositories:

1. **jmap-server** (current repo) - Backend API with autodiscovery
2. **jmap-web-client** (web/ directory) - Pure SPA frontend

## Key Design Decisions

✅ **Server handles autodiscovery** - RFC 8620 compliant via CloudFront redirect at `domain.com/.well-known/jmap`
✅ **Web client is pure SPA** - No JMAP logic, no proxying, just API calls
✅ **External DNS** - Works with any DNS provider (no Route53 requirement)
✅ **Zero coupling** - Server and client can be deployed independently
✅ **Multiple clients** - One server can support many web/desktop/mobile clients

## Changes Made

### Server Repository (Current)

#### Modified Files:
- `template.yaml` - Added `AllowedClientOrigins` parameter for CORS configuration
- `infrastructure/main.tf` - Removed frontend resources, added CloudFront for autodiscovery only
- `infrastructure/outputs.tf` - New DNS setup instructions
- `infrastructure/variables.tf` - Simplified variables
- `Makefile` - Removed build-web, updated sam-deploy with ALLOWED_ORIGINS
- `config.mk.example` - Added ALLOWED_ORIGINS parameter
- `README.md` - Comprehensive server-only documentation

#### New Files:
- `src/handlers/autodiscovery.ts` - JMAP autodiscovery redirect handler (301 to jmap.domain.com)

#### Deleted Files:
- `infrastructure/static_site.tf` - Frontend infrastructure moved to web client
- `infrastructure/redirect.js` - Replaced by CloudFront function in main.tf
- `buildspec.yml` - Unused CodeBuild configuration

### Web Client Repository (web/ directory)

#### New Files:
- `infrastructure/main.tf` - Pure S3 + CloudFront (NO JMAP API origin)
- `infrastructure/variables.tf` - Deployment configuration
- `infrastructure/outputs.tf` - DNS setup instructions
- `config.mk.example` - Deployment settings
- `.env.production.example` - Runtime configuration template
- `Makefile` - Build and deploy automation
- `README.md` - Comprehensive client documentation

#### Modified Files:
- `.gitignore` - Added config.mk, .env.production, terraform state files

## Server Architecture

```
jmap.domain.com          → API Gateway → Lambda (JMAP API)
domain.com/.well-known   → CloudFront → 301 redirect to jmap.domain.com
_jmap._tcp.domain.com    → SRV record for autodiscovery
```

**Infrastructure:**
- Lambda functions (JMAP handlers)
- API Gateway (custom domain at jmap.domain.com)
- CloudFront (autodiscovery redirect at domain.com)
- ACM certificates (2: API Gateway + CloudFront)
- Cognito (user authentication)

## Client Architecture

```
app.domain.com → CloudFront → S3 (static files)
                    ↓
              Direct API calls to jmap.domain.com
```

**Infrastructure:**
- S3 bucket (static site hosting)
- CloudFront (CDN + HTTPS)
- ACM certificate (CloudFront, us-east-1)

## Deployment Flow

### 1. Deploy Server

```bash
# In server repo root
cp config.mk.example config.mk
# Edit: REGION, ROOT_DOMAIN, ALLOWED_ORIGINS

cp .env.example .env
# Edit: ADMIN_PASSWORD

source .env
make deploy

# Create DNS records from terraform output:
# - 2x CNAME (certificate validation, temporary)
# - jmap.domain.com CNAME (API Gateway)
# - domain.com A/CNAME (CloudFront autodiscovery)
# - SRV record
```

### 2. Deploy Web Client

```bash
# In web/ directory
cp config.mk.example config.mk
# Edit: REGION, DEPLOYMENT_DOMAIN, JMAP_API_URL

cp .env.production.example .env.production
# Edit: VITE_API_URL

make deploy

# Create DNS records from terraform output:
# - 1x CNAME (certificate validation, temporary)
# - app.domain.com A/CNAME (CloudFront)
```

### 3. Test

```bash
# Test server
curl https://jmap.domain.com/.well-known/jmap

# Test autodiscovery
curl -I https://domain.com/.well-known/jmap
# Should return: 301 redirect

# Test web client
curl https://app.domain.com
```

## DNS Requirements

### Server DNS Records:
1. **jmap.domain.com** → CNAME to API Gateway
2. **domain.com** → A/CNAME to CloudFront (autodiscovery)
3. **_jmap._tcp.domain.com** → SRV record
4. 2x Certificate validation CNAMEs (temporary)

### Client DNS Records:
1. **app.domain.com** → A/CNAME to CloudFront
2. 1x Certificate validation CNAME (temporary)

## CORS Configuration

Server's `config.mk`:
```makefile
ALLOWED_ORIGINS = https://app.domain.com,https://other-client.com,http://localhost:5173
```

Add all web clients that will use the server.

## RFC 8620 Compliance

### Autodiscovery Methods (Both Implemented):

1. **SRV Record** (DNS-based):
   ```
   _jmap._tcp.domain.com → jmap.domain.com:443
   ```

2. **HTTP Redirect** (Well-known URL):
   ```
   https://domain.com/.well-known/jmap
     → 301 redirect to
   https://jmap.domain.com/.well-known/jmap
   ```

### Security:
- Fixed redirect location (no Host header usage)
- HTTPS enforced
- No open redirect vulnerability
- Single-hop redirect

## Multiple Client Support

Deploy multiple web clients pointing to same server:

```bash
# Client 1 at jmapbox.com
DEPLOYMENT_DOMAIN=jmapbox.com make deploy

# Client 2 at second.com
DEPLOYMENT_DOMAIN=second.com make deploy

# Desktop/mobile client
# Direct connection: https://jmap.jmapbox.com
```

Server `ALLOWED_ORIGINS`:
```
https://jmapbox.com,https://second.com
```

## Next Steps

### To Extract Web Client:

1. **Create new repository:**
   ```bash
   mkdir ../jmap-web-client
   cp -r web/* ../jmap-web-client/
   cd ../jmap-web-client
   git init
   git add .
   git commit -m "Initial commit: JMAP web client"
   ```

2. **Update server repo:**
   ```bash
   cd ../jmap-server
   git rm -r web/
   git add -A
   git commit -m "Split: Remove web client, now in separate repo"
   ```

3. **Deploy independently:**
   - Server: `cd jmap-server && make deploy`
   - Client: `cd jmap-web-client && make deploy`

## Benefits of This Architecture

1. ✅ **Zero Coupling** - Client and server are completely independent
2. ✅ **RFC 8620 Compliant** - Server handles autodiscovery per spec
3. ✅ **Flexible Deployment** - Deploy client anywhere (root, subdomain, different domain)
4. ✅ **Multiple Clients** - One server supports unlimited clients
5. ✅ **Universal** - Works with any DNS provider
6. ✅ **Secure** - Fixed redirects, no open redirect vulnerabilities
7. ✅ **Scalable** - Serverless architecture scales automatically

## Documentation

- **Server**: See `README.md` in repo root
- **Client**: See `web/README.md`
- **Authentication**: See `docs/AUTHENTICATION.md`

