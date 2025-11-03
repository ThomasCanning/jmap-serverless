import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { createAuthHandler, AuthenticatedContext, corsHeaders } from '../lib/auth'

export const handler = createAuthHandler(async (
  event: APIGatewayProxyEventV2,
  auth: AuthenticatedContext
): Promise<APIGatewayProxyStructuredResultV2> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(event),
    },
    body: JSON.stringify({
      accessToken: auth.bearerToken,
    }),
  }
})

