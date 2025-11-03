// Mock implementation of jose for testing
export function jwtVerify() {
  throw new Error('jwtVerify should be mocked in tests')
}

export function createRemoteJWKSet() {
  throw new Error('createRemoteJWKSet should be mocked in tests')
}

export type JWTPayload = Record<string, any>

