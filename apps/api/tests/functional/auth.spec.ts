import { test } from '@japa/runner'
import User from '#models/user'

test.group('Auth', () => {
  test('logs in with valid credentials and returns the user', async ({ client, assert }) => {
    const user = await User.findByOrFail('fullName', 'Brian')

    const response = await client.post('/api/login').withCsrfToken().json({
      email: user.email,
      password: 'test-password-123',
    })

    response.assertStatus(200)
    assert.equal(response.body().data.email, user.email)
  })

  test('rejects an invalid password', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Brian')

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
    const user = await User.findByOrFail('fullName', 'Brian')

    const response = await client.get('/api/me').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ data: { email: user.email } })
  })

  test('logout clears the session', async ({ client }) => {
    const user = await User.findByOrFail('fullName', 'Brian')

    const response = await client.post('/api/logout').withCsrfToken().loginAs(user)
    response.assertStatus(200)
  })
})
