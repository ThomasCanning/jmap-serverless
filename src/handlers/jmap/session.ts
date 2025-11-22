import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { StatusCodes } from "http-status-codes"
import { withAuth, jsonResponseHeaders } from "../../lib/auth"
import { AuthResult } from "../../lib/auth/types"
import { getSession } from "../../lib/jmap/session/get-session"
import {
  ProblemDetails,
  isProblemDetails,
  createProblemDetails,
  errorTypes,
} from "../../lib/errors"

export const sessionHandler = withAuth(
  async (
    event: APIGatewayProxyEventV2,
    auth: AuthResult
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
      const result = getSession(auth)

      if (isProblemDetails(result)) {
        return {
          statusCode: result.status,
          headers: jsonResponseHeaders(event, true),
          body: JSON.stringify(result),
        }
      }

      const session = result
      return {
        statusCode: StatusCodes.OK,
        headers: {
          ...jsonResponseHeaders(event),
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        body: JSON.stringify(session),
      }
    } catch (error) {
      const problem: ProblemDetails = isProblemDetails(error)
        ? error
        : createProblemDetails({
            type: errorTypes.internalServerError,
            status: StatusCodes.INTERNAL_SERVER_ERROR,
            detail: "Failed to get JMAP session",
            title: "Internal Server Error",
          })
      return {
        statusCode: problem.status,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(problem),
      }
    }
  }
)
