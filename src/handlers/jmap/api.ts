import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { withAuth, jsonResponseHeaders } from "../../lib/auth"

export const apiHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    return {
      statusCode: 200,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify({ message: "Hello, world!" }),
    }
  }
)
