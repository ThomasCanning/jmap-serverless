import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { withAuth, jsonResponseHeaders } from "../../lib/auth"
import { requestErrors, RequestError } from "../../lib/jmap/errors"
import { StatusCodes } from "http-status-codes"
import { z } from "zod"
import { processRequest } from "../../lib/jmap/request"
import { JmapRequest } from "../../lib/jmap/types"

export const apiHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    // Validate the request
    if (!event.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notJson,
          status: StatusCodes.BAD_REQUEST,
          detail: "Content type of the request was not application/json",
        } as RequestError),
      }
    }

    if (!event.body) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notJson,
          status: StatusCodes.BAD_REQUEST,
          detail: "Request body is missing",
        } as RequestError),
      }
    }

    let jmapRequest: Request | undefined
    try {
      //TODO ensure IJSON
      jmapRequest = JSON.parse(event.body)
    } catch {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notJson,
          status: StatusCodes.BAD_REQUEST,
          detail: "Request did not parse as I-JSON",
        } as RequestError),
      }
    }

    const requestAsSchema = requestSchema.safeParse(jmapRequest)

    if (!requestAsSchema.success) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notRequest,
          status: StatusCodes.BAD_REQUEST,
          detail:
            "The request parsed as JSON but did not match the type signature ofthe Request object",
        } as RequestError),
      }
    }

    // Process the request
    try {
      const response = processRequest(requestAsSchema.data as JmapRequest)
      return {
        statusCode: StatusCodes.OK,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(response),
      }
    } catch (error) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify(error as RequestError),
      }
    }
  }
)

const requestSchema = z.object({
  using: z.array(z.string()),
  methodCalls: z.array(z.tuple([z.string(), z.record(z.string(), z.unknown()), z.string()])).min(1),
  createdIds: z.record(z.string(), z.string()).optional(),
})
