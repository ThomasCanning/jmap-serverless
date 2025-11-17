import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import {
  authenticateRequest,
  handleAuthError,
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

  return {
    statusCode: StatusCodes.OK,
    headers: jsonResponseHeaders(event),
    body: JSON.stringify({
      accessToken: result.bearerToken,
      refreshToken: result.refreshToken,
    }),
  }
}
