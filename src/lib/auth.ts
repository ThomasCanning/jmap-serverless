import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose'

const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
  maxAttempts: 2,
  requestHandler: new NodeHttpHandler({
    requestTimeout: 3000,
    connectionTimeout: 1000,
  }),
})

export type AuthResult =
  | { ok: true; username?: string; bearerToken?: string; refreshToken?: string; claims?: JWTPayload }
  | { ok: false; statusCode: number; message: string }

export function getHeader(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const h = event.headers
  if (!h) return undefined
  // Check exact match, lowercase, uppercase, and title case (e.g., "Authorization")
  const titleCase = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  return (h[name] ?? h[name.toLowerCase()] ?? h[name.toUpperCase()] ?? h[titleCase]) as string | undefined
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  header.split(';').forEach((part) => {
    const [k, ...rest] = part.trim().split('=')
    if (!k) return
    const key = k.trim()
    const value = rest.join('=').trim()
    out[key] = decodeURIComponent(value)
  })
  return out
}

export function accessTokenCookie(token: string, maxAgeSeconds: number): string {
  const attrs = [
    `access_token=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ]
  return attrs.join('; ')
}

export function clearAccessTokenCookie(): string {
  return 'access_token=deleted; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
}

export function refreshTokenCookie(token: string, maxAgeSeconds: number): string {
  const attrs = [
    `refresh_token=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ]
  return attrs.join('; ')
}

export function clearRefreshTokenCookie(): string {
  return 'refresh_token=deleted; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
}

/**
 * Verifies Basic authentication credentials against Cognito User Pool.
 * 
 * @param authorizationHeader - Authorization header value (expected: "Basic <base64>")
 * @param userPoolClientId - Cognito User Pool Client ID
 * @returns AuthResult with access token on success
 */
export async function verifyBasicWithCognito(
  authorizationHeader: string | undefined,
  userPoolClientId: string
): Promise<AuthResult> {
  if (!authorizationHeader?.startsWith('Basic ')) {
    return { ok: false, statusCode: 401, message: 'Missing Basic auth' }
  }

  // Decode Base64 credentials
  let decoded: string
  try {
    decoded = Buffer.from(authorizationHeader.slice(6), 'base64').toString('utf8')
  } catch {
    return { ok: false, statusCode: 400, message: 'Invalid Base64' }
  }

  // Parse username:password
  const sep = decoded.indexOf(':')
  if (sep < 0) return { ok: false, statusCode: 400, message: 'Invalid Basic format' }
  const username = decoded.slice(0, sep)
  const password = decoded.slice(sep + 1)

  // Authenticate with Cognito
  try {
    const cmd = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: userPoolClientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    })
    const res = await cognito.send(cmd)
    const token = res.AuthenticationResult?.AccessToken
    const refreshToken = res.AuthenticationResult?.RefreshToken
    if (!token) {
      return { ok: false, statusCode: 502, message: 'No access token from Cognito' }
    }
    return { ok: true, username, bearerToken: token, refreshToken }
  } catch (e) {
    const err = e as Error
    console.error('[auth] InitiateAuth error', { message: err.message })
    return { ok: false, statusCode: 401, message: 'Invalid credentials' }
  }
}

/**
 * Refreshes an access token using a refresh token.
 * 
 * @param refreshToken - The refresh token from Cognito
 * @param userPoolClientId - Cognito User Pool Client ID
 * @returns AuthResult with new access token and refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  userPoolClientId: string
): Promise<AuthResult> {
  try {
    const cmd = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: userPoolClientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    })
    const res = await cognito.send(cmd)
    const token = res.AuthenticationResult?.AccessToken
    const newRefreshToken = res.AuthenticationResult?.RefreshToken || refreshToken // Cognito may return new refresh token
    
    if (!token) {
      return { ok: false, statusCode: 502, message: 'No access token from Cognito' }
    }
    return { ok: true, bearerToken: token, refreshToken: newRefreshToken }
  } catch (e) {
    const err = e as Error
    console.error('[auth] RefreshToken error', { message: err.message })
    return { ok: false, statusCode: 401, message: 'Invalid or expired refresh token' }
  }
}

/**
 * Verifies a Bearer token from the request.
 * Checks cookies first (for browser clients), then Authorization header (for API clients).
 * 
 * @param event - API Gateway event
 * @param userPoolClientId - Cognito User Pool Client ID for validation
 * @returns AuthResult with verified token and claims, or error
 */
export async function verifyBearerFromEvent(
  event: APIGatewayProxyEventV2,
  userPoolClientId: string
): Promise<AuthResult> {
  let token: string | undefined

  // 1) Check cookies first (browser-based auth)
  // API Gateway V2 provides cookies as an array
  const cookiesArray = event.cookies || []
  for (const cookie of cookiesArray) {
    if (cookie.startsWith('access_token=')) {
      token = cookie.substring('access_token='.length)
      break
    }
  }
  
  // Fallback: check Cookie header for compatibility
  if (!token) {
    const cookieHeader = getHeader(event, 'cookie')
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader)
      token = cookies['access_token']
    }
  }

  // 2) If no token in cookies, check Authorization header for Bearer token
  if (!token) {
    const authz = getHeader(event, 'authorization')
    if (authz?.startsWith('Bearer ')) {
      token = authz.slice(7)
    }
  }

  if (!token) {
    return { ok: false, statusCode: 401, message: 'Missing Bearer token' }
  }

  try {
    // Parse JWT to get issuer (without verifying signature yet)
    const parts = token.split('.')
    if (parts.length < 2) {
      return { ok: false, statusCode: 400, message: 'Invalid JWT' }
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')) as JWTPayload
    const iss = payload.iss as string | undefined
    if (!iss) {
      return { ok: false, statusCode: 400, message: 'Missing iss' }
    }

    // Fetch JWKS and verify signature
    const JWKS = createRemoteJWKSet(new URL(`${iss}/.well-known/jwks.json`))
    const { payload: claims } = await jwtVerify(token, JWKS, {
      issuer: iss,
    })

    // Post-verification: validate token type and client ID
    // Cognito AccessTokens use 'client_id', not 'aud' claim
    const tokenUse = (claims as any).token_use as string | undefined
    const clientIdClaim = (claims as any).client_id as string | undefined
    const audienceClaim = claims.aud as string | string[] | undefined

    if (tokenUse === 'access') {
      if (clientIdClaim !== userPoolClientId) {
        return { ok: false, statusCode: 401, message: 'Invalid token' }
      }
    } else if (tokenUse === 'id' || audienceClaim) {
      // ID tokens use 'aud' claim
      const audOk = Array.isArray(audienceClaim)
        ? audienceClaim.includes(userPoolClientId)
        : audienceClaim === userPoolClientId
      if (!audOk) {
        return { ok: false, statusCode: 401, message: 'Invalid token' }
      }
    } else {
      return { ok: false, statusCode: 401, message: 'Invalid token' }
    }

    return { ok: true, claims, bearerToken: token }
  } catch (e) {
    const err = e as Error
    console.error('[auth] Token verification failed', {
      error: err.message,
      errorName: err.name,
    })
    return { ok: false, statusCode: 401, message: 'Invalid token' }
  }
}

// We avoid sending WWW-Authenticate entirely to prevent browser prompts.
export function unauthorizedHeadersFor(_event: APIGatewayProxyEventV2): Record<string, string> {
  return { 'Content-Type': 'application/json' }
}

// For browser requests (Origin present) use 403 to avoid native prompt behavior.
export function unauthorizedStatusFor(event: APIGatewayProxyEventV2): number {
  const origin = getHeader(event, 'origin')
  return origin ? 403 : 401
}

export function corsHeaders(event: APIGatewayProxyEventV2): Record<string, string> {
  const origin = getHeader(event, 'origin')
  const headers: Record<string, string> = {}
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers['Access-Control-Allow-Headers'] = 'authorization, content-type'
    headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
  }
  return headers
}

// Auth middleware wrapper
export type AuthenticatedContext = AuthResult & { ok: true }

export type HandlerFunction = (
  event: APIGatewayProxyEventV2,
  auth: AuthenticatedContext
) => Promise<APIGatewayProxyStructuredResultV2>

// Cookie configuration constants
const DEFAULT_COOKIE_MAX_AGE = 3600 // 1 hour (matches Cognito access token lifetime)
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

export interface AuthOptions {
  requireAuth?: boolean
}

/**
 * Wraps a handler function with centralized authentication logic.
 * 
 * Authentication flow:
 * 1. Check cookies for Bearer token (browser-based auth)
 * 2. Check Authorization header for Bearer token (API clients)
 * 3. If Bearer fails and token was from cookie, try refresh token (automatic refresh)
 * 4. If Bearer fails and no Bearer header present, try Basic auth
 * 
 * Automatic Token Refresh:
 * - If access token is expired/invalid and came from a cookie, automatically attempts refresh
 * - Uses refresh_token cookie if available
 * - Updates both access_token and refresh_token cookies on successful refresh
 * - Transparent to client - no error is returned, request continues normally
 * 
 * Note: Cookies are always set when Basic auth succeeds (for browser session management).
 * 
 * @param handler - The handler function to wrap. Receives event and authenticated context.
 * @param options - Configuration options
 *   - requireAuth: If true, returns 401/403 if auth fails. Default: true.
 * 
 * Note: HTTP method validation is handled by API Gateway routing, not in this wrapper.
 */
export function withAuth(
  handler: HandlerFunction,
  options: AuthOptions = {}
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2> {
  const {
    requireAuth = true,
  } = options

  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
      const clientId = process.env.USER_POOL_CLIENT_ID
      if (!clientId) {
        console.error('Missing USER_POOL_CLIENT_ID env var')
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(event) },
          body: JSON.stringify({ error: 'Server misconfiguration (USER_POOL_CLIENT_ID missing)' }),
        }
      }

      // 1) Try Bearer token: check cookies first, then Authorization header
      // Track if token came from cookie (for auto-refresh) BEFORE verification
      const cookiesArray = event.cookies || []
      const cookieHeader = getHeader(event, 'cookie')
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
      const tokenSourceWasCookie = cookiesArray.some(c => c.startsWith('access_token=')) || 
                                   !!cookies['access_token']
      
      // Check if refresh token is present (even if access token has expired and wasn't sent)
      const hasRefreshToken = cookiesArray.some(c => c.startsWith('refresh_token=')) || 
                             !!cookies['refresh_token']
      
      let authResult = await verifyBearerFromEvent(event, clientId)

      // 2) If Bearer fails and we have a refresh token (even if access token expired), try refresh
      // This handles the case where the access_token cookie expired so browser didn't send it
      if (!authResult.ok && (tokenSourceWasCookie || hasRefreshToken)) {
        // Extract refresh token from cookie (reuse parsed cookies)
        let refreshToken: string | undefined
        for (const cookie of cookiesArray) {
          if (cookie.startsWith('refresh_token=')) {
            refreshToken = cookie.substring('refresh_token='.length)
            break
          }
        }
        if (!refreshToken && cookies['refresh_token']) {
          refreshToken = cookies['refresh_token']
        }

        // If refresh token exists, try to refresh
        if (refreshToken) {
          const refreshed = await refreshAccessToken(refreshToken, clientId)
          if (refreshed.ok && refreshed.bearerToken) {
            authResult = refreshed
            
            // Update cookies with new tokens
            const handlerResponse = await handler(event, authResult as AuthenticatedContext)
            const cookieHeaders: string[] = []
            cookieHeaders.push(accessTokenCookie(refreshed.bearerToken, DEFAULT_COOKIE_MAX_AGE))
            if (refreshed.refreshToken) {
              cookieHeaders.push(refreshTokenCookie(refreshed.refreshToken, REFRESH_TOKEN_MAX_AGE))
            }
            
            return {
              ...handlerResponse,
              cookies: cookieHeaders,
            }
          }
          // If refresh failed, continue to Basic auth fallback
        }
      }

      // 3) If Bearer fails, try Basic auth (only if Authorization header doesn't have Bearer)
      if (!authResult.ok) {
        const authzHeader =
          (event.headers?.authorization as string) ?? (event.headers?.Authorization as string)

        // Only try Basic if there's no Bearer token in the header
        // (if Bearer was present but invalid, return that error instead)
        if (!authzHeader?.startsWith('Bearer ')) {
          const basic = await verifyBasicWithCognito(authzHeader, clientId)

          if (basic.ok && basic.bearerToken) {
            authResult = basic

            // Always set cookies when Basic auth succeeds (for browser session management)
            const handlerResponse = await handler(event, authResult as AuthenticatedContext)
            const cookieHeaders: string[] = []
            cookieHeaders.push(accessTokenCookie(basic.bearerToken, DEFAULT_COOKIE_MAX_AGE))
            if (basic.refreshToken) {
              cookieHeaders.push(refreshTokenCookie(basic.refreshToken, REFRESH_TOKEN_MAX_AGE))
            }
            
            return {
              ...handlerResponse,
              cookies: cookieHeaders,
            }
          } else if (requireAuth) {
            // Auth required but both Bearer and Basic failed
            return {
              statusCode: basic.ok ? unauthorizedStatusFor(event) : basic.statusCode,
              headers: unauthorizedHeadersFor(event),
              body: JSON.stringify({ error: basic.ok ? 'Unauthorized' : basic.message }),
            }
          }
        } else if (requireAuth) {
          // Bearer token was present but invalid - return Bearer error
          return {
            statusCode: authResult.statusCode,
            headers: unauthorizedHeadersFor(event),
            body: JSON.stringify({ error: authResult.message }),
          }
        }
      }

      // If auth succeeded, call handler with auth context
      if (authResult.ok) {
        return await handler(event, authResult as AuthenticatedContext)
      }

      // If auth not required and failed, we still need to provide auth context
      // But since auth failed, we can't call the handler (it requires auth)
      // This case shouldn't happen if requireAuth is false
      if (!requireAuth) {
        // For optional auth handlers, create a wrapper that makes auth optional
        // But since we're requiring it in the type, this shouldn't be reached
        throw new Error('Handler requires auth but requireAuth is false')
      }

      // Should not reach here, but TypeScript needs this
      return {
        statusCode: 401,
        headers: unauthorizedHeadersFor(event),
        body: JSON.stringify({ error: 'Unauthorized' }),
      }
    } catch (error) {
      console.error('Handler error:', error)
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(event) },
        body: JSON.stringify({ error: 'Internal server error' }),
      }
    }
  }
}

/**
 * Creates an authenticated handler (shorthand for withAuth).
 * All handlers created with this automatically require authentication.
 * 
 * Usage:
 * ```typescript
 * export const handler = createAuthHandler(async (event, auth) => {
 *   // Your handler code - auth is guaranteed to be present
 * })
 * ```
 */
export function createAuthHandler(
  handler: HandlerFunction
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2> {
  return withAuth(handler, { requireAuth: true })
}
