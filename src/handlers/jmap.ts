import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { createAuthHandler, AuthenticatedContext, corsHeaders } from '../lib/auth'

export const jmapHandler = createAuthHandler(async (
  event: APIGatewayProxyEventV2,
  auth: AuthenticatedContext
): Promise<APIGatewayProxyStructuredResultV2> => {
  // TODO: implement JMAP method processing. For now, echo an empty response shape
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(event) },
    body: JSON.stringify({ methodResponses: [] }),
  }
})


