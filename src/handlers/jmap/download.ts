import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { withAuth, jsonResponseHeaders } from "../../lib/auth"
import { StatusCodes } from "http-status-codes"
import { download } from "../../lib/jmap/blob/download"
import { Id } from "../../lib/jmap/types"
import {
  ProblemDetails,
  createProblemDetails,
  errorTypes,
  isProblemDetails,
} from "../../lib/errors"

export const downloadHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const accountId = event.pathParameters?.accountId as Id
    const blobId = event.pathParameters?.blobId as Id
    const name = event.pathParameters?.name
    const type = event.queryStringParameters?.type

    if (!accountId || !blobId || !name || !type) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(
          createProblemDetails({
            type: errorTypes.badRequest,
            status: StatusCodes.BAD_REQUEST,
            title: "Missing required parameters",
            detail: `Must specify: accountId=${accountId}, blobId=${blobId}, name=${name}, type=${type}`,
          })
        ),
      }
    }

    try {
      const result = await download(accountId, blobId)

      if (isProblemDetails(result)) {
        return {
          statusCode: result.status,
          headers: jsonResponseHeaders(event, true),
          body: JSON.stringify(result),
        }
      }

      const data = result

      return {
        statusCode: StatusCodes.OK,
        headers: {
          ...jsonResponseHeaders(event),
          "Content-Type": type,
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "private, immutable, max-age=31536000",
        },
        body: data.toString("base64"),
        isBase64Encoded: true,
      }
    } catch (error) {
      const problem: ProblemDetails = isProblemDetails(error)
        ? error
        : createProblemDetails({
            type: errorTypes.internalServerError,
            status: StatusCodes.INTERNAL_SERVER_ERROR,
            title: "Internal Server Error",
            detail: "Failed to download blob",
          })
      return {
        statusCode: problem.status,
        headers: jsonResponseHeaders(event, true),
        body: JSON.stringify(problem),
      }
    }
  }
)
