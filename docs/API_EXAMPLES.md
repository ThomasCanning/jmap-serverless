# API Examples

This document provides example commands for interacting with the JMAP server API.

## Base URL

Replace `jmapbox.com` with your domain:

- API: `https://api.jmapbox.com`
- Autodiscovery: `https://jmapbox.com`

## Authentication

Get an access token:

```bash
# Note: /auth/token requires POST method
TOKEN=$(curl -s -X POST https://api.jmapbox.com/auth/token \
  -u 'admin@jmapbox.com:Password123!' | jq -r '.accessToken')

echo "Token: $TOKEN"
```

## Logout

```bash
curl -X POST https://api.jmapbox.com/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

## JMAP Endpoints

### Session Discovery

```bash
curl https://api.jmapbox.com/jmap/session \
  -H "Authorization: Bearer $TOKEN"

# If you get "Unauthorized", try debugging:
# 1. Check token is not null
echo "Token: $TOKEN"

# 2. Decode token to check claims (requires jq)
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .

# 3. Try with verbose output to see response
curl -v https://api.jmapbox.com/jmap/session \
  -H "Authorization: Bearer $TOKEN"
```
