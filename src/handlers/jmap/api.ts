import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { withAuth, jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { postApi } from "../../lib/jmap/api/post-api"
import { RequestError, requestErrors, isRequestError } from "../../lib/jmap/errors"

export const apiHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    // Convert headers to Record<string, string> by filtering out undefined values
    const headers: Record<string, string> = {}
    if (event.headers) {
      for (const [key, value] of Object.entries(event.headers)) {
        if (value !== undefined) {
          headers[key] = value
        }
      }
    }

    if (!event.body) {
      const requestError: RequestError = {
        type: requestErrors.notRequest,
        status: StatusCodes.BAD_REQUEST,
        detail: "Request body is missing",
      }
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(requestError),
      }
    }

    const response = await postApi(headers, event.body)
    if (isRequestError(response)) {
      return {
        statusCode: response.status,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(response),
      }
    } else {
      return {
        statusCode: StatusCodes.OK,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(response),
      }
    }
  }
)
