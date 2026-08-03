import { test } from '@japa/runner'
import User from '#models/user'

test.group('Users / index', () => {
  test('lists all users ordered by full name', async ({ client }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')

    const response = await client.get('/api/users').loginAs(adam)

    response.assertStatus(200)
    response.assertBodyContains({
      data: [{ fullName: 'Eve' }, { fullName: 'Adam' }],
    })
  })
})

test.group('Users / update', () => {
  test("updates the current user's own display color", async ({ client, assert }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .patch(`/api/users/${adam.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ displayColor: '#00ff00' })

    response.assertStatus(200)
    assert.equal(response.body().data.displayColor, '#00ff00')
  })

  test("rejects updating a different user's profile", async ({ client }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')
    const eve = await User.findByOrFail('fullName', 'Eve')

    const response = await client
      .patch(`/api/users/${eve.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ displayColor: '#00ff00' })

    response.assertStatus(403)
  })
})

test.group('Users / changePassword', () => {
  test("changes the current user's own password with the correct current password", async ({
    client,
    assert,
  }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .put(`/api/users/${adam.id}/password`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ currentPassword: 'test-password-123', newPassword: 'a-new-password' })

    response.assertStatus(204)

    const verified = await User.verifyCredentials(adam.email, 'a-new-password')
    assert.equal(verified.id, adam.id)
  })

  test('rejects an incorrect current password', async ({ client }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .put(`/api/users/${adam.id}/password`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ currentPassword: 'wrong-password', newPassword: 'a-new-password' })

    response.assertStatus(400)
  })

  test("rejects changing a different user's password", async ({ client }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')
    const eve = await User.findByOrFail('fullName', 'Eve')

    const response = await client
      .put(`/api/users/${eve.id}/password`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ currentPassword: 'test-password-123', newPassword: 'a-new-password' })

    response.assertStatus(403)
  })
})

test.group('Users / changeEmail', () => {
  test("changes the current user's own email with the correct current password", async ({
    client,
    assert,
  }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .put(`/api/users/${adam.id}/email`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ currentPassword: 'test-password-123', newEmail: 'brand-new@test.local' })

    response.assertStatus(200)
    assert.equal(response.body().data.email, 'brand-new@test.local')
  })

  test('rejects an incorrect current password', async ({ client }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')

    const response = await client
      .put(`/api/users/${adam.id}/email`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ currentPassword: 'wrong-password', newEmail: 'brand-new@test.local' })

    response.assertStatus(400)
  })

  test('rejects changing to an email already in use by another user', async ({ client }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')
    const eve = await User.findByOrFail('fullName', 'Eve')

    const response = await client
      .put(`/api/users/${adam.id}/email`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ currentPassword: 'test-password-123', newEmail: eve.email })

    response.assertStatus(409)
  })

  test("rejects changing a different user's email", async ({ client }) => {
    const adam = await User.findByOrFail('fullName', 'Adam')
    const eve = await User.findByOrFail('fullName', 'Eve')

    const response = await client
      .put(`/api/users/${eve.id}/email`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ currentPassword: 'test-password-123', newEmail: 'brand-new@test.local' })

    response.assertStatus(403)
  })
})
