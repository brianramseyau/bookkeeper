import { test } from '@japa/runner'
import User from '#models/user'

test.group('Users / index', () => {
  test('lists all users ordered by full name', async ({ client }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')

    const response = await client.get('/api/users').loginAs(brian)

    response.assertStatus(200)
    response.assertBodyContains({
      data: [{ fullName: 'Ariel' }, { fullName: 'Brian' }],
    })
  })
})

test.group('Users / update', () => {
  test("updates the current user's own display color", async ({ client, assert }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')

    const response = await client
      .patch(`/api/users/${brian.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ displayColor: '#00ff00' })

    response.assertStatus(200)
    assert.equal(response.body().data.displayColor, '#00ff00')
  })

  test("rejects updating a different user's profile", async ({ client }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')
    const ariel = await User.findByOrFail('fullName', 'Ariel')

    const response = await client
      .patch(`/api/users/${ariel.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ displayColor: '#00ff00' })

    response.assertStatus(403)
  })
})

test.group('Users / changePassword', () => {
  test("changes the current user's own password with the correct current password", async ({
    client,
    assert,
  }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')

    const response = await client
      .put(`/api/users/${brian.id}/password`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ currentPassword: 'test-password-123', newPassword: 'a-new-password' })

    response.assertStatus(204)

    const verified = await User.verifyCredentials(brian.email, 'a-new-password')
    assert.equal(verified.id, brian.id)
  })

  test('rejects an incorrect current password', async ({ client }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')

    const response = await client
      .put(`/api/users/${brian.id}/password`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ currentPassword: 'wrong-password', newPassword: 'a-new-password' })

    response.assertStatus(400)
  })

  test("rejects changing a different user's password", async ({ client }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')
    const ariel = await User.findByOrFail('fullName', 'Ariel')

    const response = await client
      .put(`/api/users/${ariel.id}/password`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ currentPassword: 'test-password-123', newPassword: 'a-new-password' })

    response.assertStatus(403)
  })
})

test.group('Users / changeEmail', () => {
  test("changes the current user's own email with the correct current password", async ({
    client,
    assert,
  }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')

    const response = await client
      .put(`/api/users/${brian.id}/email`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ currentPassword: 'test-password-123', newEmail: 'brand-new@test.local' })

    response.assertStatus(200)
    assert.equal(response.body().data.email, 'brand-new@test.local')
  })

  test('rejects an incorrect current password', async ({ client }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')

    const response = await client
      .put(`/api/users/${brian.id}/email`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ currentPassword: 'wrong-password', newEmail: 'brand-new@test.local' })

    response.assertStatus(400)
  })

  test('rejects changing to an email already in use by another user', async ({ client }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')
    const ariel = await User.findByOrFail('fullName', 'Ariel')

    const response = await client
      .put(`/api/users/${brian.id}/email`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ currentPassword: 'test-password-123', newEmail: ariel.email })

    response.assertStatus(409)
  })

  test("rejects changing a different user's email", async ({ client }) => {
    const brian = await User.findByOrFail('fullName', 'Brian')
    const ariel = await User.findByOrFail('fullName', 'Ariel')

    const response = await client
      .put(`/api/users/${ariel.id}/email`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ currentPassword: 'test-password-123', newEmail: 'brand-new@test.local' })

    response.assertStatus(403)
  })
})
