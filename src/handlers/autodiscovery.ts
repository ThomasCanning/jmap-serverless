/**
 * JMAP Autodiscovery Handler (RFC 8620)
 * 
 * Returns 301 redirect to the JMAP session endpoint at jmap.domain.com
 * This is served at domain.com/.well-known/jmap for HTTP-based autodiscovery
 */

export const handler = async () => {
  return {
    statusCode: 301,
    headers: {
      'Location': process.env.JMAP_SESSION_URL || '',
      'Cache-Control': 'public, max-age=3600'
    },
    body: ''
  }
}

