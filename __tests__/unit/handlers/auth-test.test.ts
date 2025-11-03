import { authTestHandler } from '../../../src/handlers/auth-test'
const baseEvent = (overrides: any = {}) =>
  ({ path: '/auth-test', httpMethod: 'GET', ...overrides } as any)

describe('authTestHandler', () => {
  it('returns 200 and hello on GET', async () => {
    const event = baseEvent()
    const res = await authTestHandler(event)
    expect(res.statusCode).toBe(200)
    expect(res.headers?.['Content-Type']).toBe('application/json')
    expect(JSON.parse(res.body)).toEqual({ message: 'hello' })
  })

  it('throws on non-GET methods', async () => {
    const event = baseEvent({ httpMethod: 'POST' })
    await expect(authTestHandler(event)).rejects.toThrow(/only accept GET method/i)
  })
})


