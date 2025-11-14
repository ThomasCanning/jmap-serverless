import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import {
  authenticateRequest,
  handleAuthError,
  setAuthCookies,
  jsonResponseHeaders,
  isAuthenticatedContext,
} from "../../lib/auth"

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const result = await authenticateRequest(event)

  if (!isAuthenticatedContext(result)) {
    return handleAuthError(event, result)
  }

  const cookieHeaders = setAuthCookies(result.bearerToken, result.refreshToken)
  return {
    statusCode: 200,
    headers: jsonResponseHeaders(event),
    cookies: cookieHeaders,
    body: JSON.stringify({ success: true }),
  }
}
