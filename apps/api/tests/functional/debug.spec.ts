import { test } from '@japa/runner'
import User from '#models/user'
import env from '#start/env'

const EMAIL_HEADER = 'x-authentik-email'
const SECRET_HEADER = 'x-authentik-shared-secret'
const VALID_SECRET = 'test-authentik-shared-secret'

test.group('Debug endpoint', () => {
  test('is reachable without authentication and reports basic info', async ({ client, assert }) => {
    const response = await client.get('/debug')

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.auth.isAuthenticated, false)
    assert.isString(body.server.nodeVersion)
    assert.property(body.headers, 'host')
  })

  test('redacts the cookie and shared-secret headers', async ({ client, assert }) => {
    const response = await client
      .get('/debug')
      .header('cookie', 'super-secret-session=abc')
      .header(SECRET_HEADER, VALID_SECRET)

    response.assertStatus(200)
    const body = response.body()
    assert.notInclude(body.headers.cookie, 'super-secret-session')
    assert.notInclude(body.headers[SECRET_HEADER], VALID_SECRET)
  })

  test('reflects auth state when logged in', async ({ client, assert }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')

    const response = await client.get('/debug').loginAs(adam)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.auth.isAuthenticated, true)
    assert.equal(body.auth.user.email, adam.email)
  })

  test('reports authentik proxy auth diagnostics', async ({ client, assert }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .get('/debug')
      .header(SECRET_HEADER, VALID_SECRET)
      .header(EMAIL_HEADER, adam.email)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.authentikProxyAuth.proxyAuthEnabled, env.get('AUTHENTIK_PROXY_AUTH_ENABLED'))
    assert.equal(body.authentikProxyAuth.secretMatches, true)
    assert.equal(body.authentikProxyAuth.matchedLocalUser.email, adam.email)
    assert.equal(body.authentikProxyAuth.wouldAutoLoginOnNextRequest, true)
  })

  test('never leaks the configured shared secret value', async ({ client, assert }) => {
    const response = await client.get('/debug')

    const body = JSON.stringify(response.body())
    assert.notInclude(body, env.get('AUTHENTIK_SHARED_SECRET') ?? '__unset__')
  })
})
