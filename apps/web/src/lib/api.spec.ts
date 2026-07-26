import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api', () => {
  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
  })

  it('sends a GET request without a body or content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { id: 1 } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.get<{ id: number }>('/things')

    expect(result).toEqual({ id: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/things')
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('include')
    expect(init.headers).toEqual({})
    expect(init.body).toBeUndefined()
  })

  it('unwraps the top-level payload when there is no data key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { year: 2026, months: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.get<{ year: number }>('/standard-month')

    expect(result).toEqual({ year: 2026, months: [] })
  })

  it('sends a JSON content-type header and body for POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { data: { id: 2 } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.post('/things', { name: 'Salary' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ name: 'Salary' }))
  })

  it('attaches the XSRF token header from a cookie on non-GET requests', async () => {
    document.cookie = 'XSRF-TOKEN=abc%20123'
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await api.patch('/things/1', { name: 'Updated' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-XSRF-TOKEN']).toBe('abc 123')
  })

  it('omits the XSRF header on a non-GET request when no cookie is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await api.delete('/things/1')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('sends no body for a PUT call with no input', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await api.put('/things/1')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBeUndefined()
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('returns undefined for a 204 No Content response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.delete('/things/1')

    expect(result).toBeUndefined()
  })

  async function captureError(promise: Promise<unknown>): Promise<ApiError> {
    try {
      await promise
    } catch (error) {
      return error as ApiError
    }
    throw new Error('expected promise to reject')
  }

  it('throws an ApiError using the first validator error message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { errors: [{ message: 'Name is required' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await captureError(api.post('/things', {}))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.message).toBe('Name is required')
  })

  it('falls back to a top-level message when there are no validator errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { message: 'Not found' }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await captureError(api.get('/missing'))

    expect(error.status).toBe(404)
    expect(error.message).toBe('Not found')
  })

  it('falls back to the response status text when the error body has no message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 500, statusText: 'Internal Server Error' }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await captureError(api.get('/broken'))

    expect(error.message).toBe('Internal Server Error')
  })

  it('falls back to the response status text when the error body is not valid JSON', async () => {
    const response = new Response('not json', { status: 500, statusText: 'Server Error' })
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)

    const error = await captureError(api.get('/broken'))

    expect(error.message).toBe('Server Error')
  })
})
