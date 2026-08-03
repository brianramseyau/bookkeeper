import { test } from '@japa/runner'
import User from '#models/user'

test.group('Auth', () => {
  test('logs in with valid credentials and returns the user', async ({ client, assert }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    const response = await client.post('/api/login').withCsrfToken().json({
      email: user.email,
      password: 'test-password-123',
    })

    response.assertStatus(200)
    assert.equal(response.body().data.email, user.email)
  })

  test('rejects an invalid password', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    const response = await client.post('/api/login').withCsrfToken().json({
      email: user.email,
      password: 'wrong-password',
    })

    response.assertStatus(400)
  })

  test('rejects an unknown email', async ({ client }) => {
    const response = await client.post('/api/login').withCsrfToken().json({
      email: 'nobody@test.local',
      password: 'test-password-123',
    })

    response.assertStatus(400)
  })

  test('GET /me requires authentication', async ({ client }) => {
    const response = await client.get('/api/me')
    response.assertStatus(401)
  })

  test('GET /me returns the logged-in user', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    const response = await client.get('/api/me').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ data: { email: user.email } })
  })

  test('logout clears the session', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Adam')

    const response = await client.post('/api/logout').withCsrfToken().loginAs(user)
    response.assertStatus(200)
  })

  test('allows repeated login attempts up to the throttle limit', async ({ client }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await client.post('/api/login').withCsrfToken().json({
        email: 'throttle-allowed@test.local',
        password: 'wrong-password',
      })
      response.assertStatus(400)
    }
  })

  test('throttles login attempts after 5 failures for the same IP+email', async ({ client }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await client.post('/api/login').withCsrfToken().json({
        email: 'throttle-blocked@test.local',
        password: 'wrong-password',
      })
      response.assertStatus(400)
    }

    const response = await client.post('/api/login').withCsrfToken().json({
      email: 'throttle-blocked@test.local',
      password: 'wrong-password',
    })
    response.assertStatus(429)
  })
})
