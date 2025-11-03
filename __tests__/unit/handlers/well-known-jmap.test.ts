import { wellKnownJmapHandler } from '../../../src/handlers/well-known-jmap'
const baseEvent = (overrides: any = {}) =>
  ({ path: '/.well-known/jmap', httpMethod: 'GET', ...overrides } as any)

describe('wellKnownJmapHandler', () => {
  const ORIGINAL_API_URL = process.env.API_URL
  beforeEach(() => {
    process.env.API_URL = 'https://jmap.example.com/'
  })
  afterEach(() => {
    process.env.API_URL = ORIGINAL_API_URL
  })

  it('returns 200 and JSON payload on GET', async () => {
    const event = baseEvent()
    const res = await wellKnownJmapHandler(event)
    expect(res.statusCode).toBe(200)
    expect(res.headers?.['Content-Type']).toBe('application/json')
    const body = JSON.parse(res.body)
    expect(body).toEqual({
      capabilities: {},
      apiUrl: 'https://jmap.example.com/',
      primaryAccounts: {},
    })
  })

  it('throws on non-GET methods', async () => {
    const event = baseEvent({ httpMethod: 'POST' })
    await expect(wellKnownJmapHandler(event)).rejects.toThrow(
      /only accept GET method/i,
    )
  })
})


