import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

export const authTestHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== 'GET') {
    throw new Error(`authTest only accept GET method, you tried: ${event.httpMethod}`)
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  }
}


