import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import {
  authenticate,
  refresh,
  handleAuthError,
  jsonResponseHeaders,
  isAuthenticatedContext,
  getHeader,
  parseBasicAuth,
} from "../../lib/auth"
import { AuthResult } from "../../lib/auth/types"
import { validateEnvVar } from "../../lib/env"

export type TokenRequest = {
  username?: string
  password?: string
  refreshToken?: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const clientIdResult = validateEnvVar("USER_POOL_CLIENT_ID", process.env.USER_POOL_CLIENT_ID)
  if (!clientIdResult.ok) {
    return handleAuthError(event, clientIdResult)
  }

  let body: TokenRequest | undefined
  if (event.body) {
    try {
      body = JSON.parse(event.body) as TokenRequest
    } catch {
      return handleAuthError(event, {
        ok: false,
        statusCode: 400,
        message: "Invalid JSON in request body",
      })
    }
  }

  let result: AuthResult

  // Check if this is a refresh token request
  if (
    body?.refreshToken &&
    typeof body.refreshToken === "string" &&
    body.refreshToken.trim().length > 0
  ) {
    result = await refresh(body.refreshToken.trim(), clientIdResult.value)
  } else {
    // Otherwise, treat as credentials-based authentication
    let username: string | undefined
    let password: string | undefined

    if (body?.username && body?.password) {
      username = body.username
      password = body.password
    } else {
      const authzHeader = getHeader(event, "authorization")
      const basicAuth = parseBasicAuth(authzHeader)
      if (!basicAuth.ok) {
        return handleAuthError(event, {
          ok: false,
          statusCode: 400,
          message:
            'Missing username and password. Provide credentials in the request body as JSON: {"username": "user@example.com", "password": "password"}, or use Basic auth with the Authorization header.',
        })
      }
      username = basicAuth.username
      password = basicAuth.password
    }

    result = await authenticate(username, password, clientIdResult.value)
  }

  if (!isAuthenticatedContext(result)) {
    return handleAuthError(event, result)
  }

  if (!result.bearerToken || !result.refreshToken) {
    return handleAuthError(event, {
      ok: false,
      statusCode: 500,
      message: "Internal error: tokens not returned from authentication",
    })
  }

  const response: TokenResponse = {
    accessToken: result.bearerToken,
    refreshToken: result.refreshToken,
  }

  return {
    statusCode: 200,
    headers: jsonResponseHeaders(event),
    body: JSON.stringify(response),
  }
}
