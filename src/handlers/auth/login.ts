import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import {
  authenticate,
  handleAuthError,
  setAuthCookies,
  jsonResponseHeaders,
  isAuthenticatedContext,
  getHeader,
  parseBasicAuth,
} from "../../lib/auth"
import { AuthResult } from "../../lib/auth/types"
import { validateEnvVar } from "../../lib/env"
import { TokenRequest } from "./token"

export type LoginRequest = Pick<TokenRequest, "username" | "password">

export interface LoginResponse {
  success: boolean
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

  let username: string
  let password: string

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

  const result: AuthResult = await authenticate(username, password, clientIdResult.value)

  if (!isAuthenticatedContext(result)) {
    return handleAuthError(event, result)
  }

  const cookieHeaders = setAuthCookies(result.bearerToken, result.refreshToken)
  const response: LoginResponse = { success: true }
  return {
    statusCode: 200,
    headers: jsonResponseHeaders(event),
    cookies: cookieHeaders,
    body: JSON.stringify(response),
  }
}
