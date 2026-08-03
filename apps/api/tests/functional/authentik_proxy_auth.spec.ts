import { test } from '@japa/runner'
import User from '#models/user'
import env from '#start/env'

const EMAIL_HEADER = 'x-authentik-email'
const SECRET_HEADER = 'x-authentik-shared-secret'
const VALID_SECRET = 'test-authentik-shared-secret'

test.group('Authentik proxy auto-login', () => {
  test('auto-logs-in when the shared secret and a known email are present', async ({
    client,
    assert,
  }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .get('/api/me')
      .header(SECRET_HEADER, VALID_SECRET)
      .header(EMAIL_HEADER, user.email)

    response.assertStatus(200)
    assert.equal(response.body().data.email, user.email)
  })

  test('does nothing when the feature is disabled', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    env.set('AUTHENTIK_PROXY_AUTH_ENABLED', false)
    try {
      const response = await client
        .get('/api/me')
        .header(SECRET_HEADER, VALID_SECRET)
        .header(EMAIL_HEADER, user.email)

      response.assertStatus(401)
    } finally {
      env.set('AUTHENTIK_PROXY_AUTH_ENABLED', true)
    }
  })

  test('does not override an existing session', async ({ client, assert }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')
    const other = await User.query().whereNot('id', adam.id).firstOrFail()

    const response = await client
      .get('/api/me')
      .loginAs(other)
      .header(SECRET_HEADER, VALID_SECRET)
      .header(EMAIL_HEADER, adam.email)

    response.assertStatus(200)
    assert.equal(response.body().data.email, other.email)
  })

  test('rejects a missing shared secret', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    const response = await client.get('/api/me').header(EMAIL_HEADER, user.email)

    response.assertStatus(401)
  })

  test('rejects an incorrect shared secret', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .get('/api/me')
      .header(SECRET_HEADER, 'not-the-right-secret')
      .header(EMAIL_HEADER, user.email)

    response.assertStatus(401)
  })

  test('rejects a shared secret of a different length', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .get('/api/me')
      .header(SECRET_HEADER, 'short')
      .header(EMAIL_HEADER, user.email)

    response.assertStatus(401)
  })

  test('does nothing when no email header is present', async ({ client }) => {
    const response = await client.get('/api/me').header(SECRET_HEADER, VALID_SECRET)

    response.assertStatus(401)
  })

  test('does nothing when the email does not match a user', async ({ client }) => {
    const response = await client
      .get('/api/me')
      .header(SECRET_HEADER, VALID_SECRET)
      .header(EMAIL_HEADER, 'nobody@test.local')

    response.assertStatus(401)
  })

  test('warns and skips when no shared secret is configured', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    env.set('AUTHENTIK_SHARED_SECRET', '')
    try {
      const response = await client
        .get('/api/me')
        .header(SECRET_HEADER, VALID_SECRET)
        .header(EMAIL_HEADER, user.email)

      response.assertStatus(401)
    } finally {
      env.set('AUTHENTIK_SHARED_SECRET', VALID_SECRET)
    }
  })
})
