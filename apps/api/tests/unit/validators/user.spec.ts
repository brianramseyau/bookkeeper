import { test } from '@japa/runner'
import {
  loginValidator,
  updateProfileValidator,
  changePasswordValidator,
  changeEmailValidator,
} from '#validators/user'

test.group('loginValidator', () => {
  test('accepts a valid email and password', async ({ assert }) => {
    const payload = await loginValidator.validate({
      email: 'brian@example.com',
      password: 'anything',
    })
    assert.equal(payload.email, 'brian@example.com')
  })

  test('rejects an invalid email', async ({ assert }) => {
    await assert.rejects(() =>
      loginValidator.validate({ email: 'not-an-email', password: 'anything' })
    )
  })

  test('rejects a missing password', async ({ assert }) => {
    await assert.rejects(() => loginValidator.validate({ email: 'brian@example.com' }))
  })
})

test.group('updateProfileValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateProfileValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('allows a null displayColor', async ({ assert }) => {
    const payload = await updateProfileValidator.validate({ displayColor: null })
    assert.isNull(payload.displayColor)
  })
})

test.group('changePasswordValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await changePasswordValidator.validate({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    })
    assert.equal(payload.newPassword, 'new-password-123')
  })

  test('rejects a newPassword shorter than 8 characters', async ({ assert }) => {
    await assert.rejects(() =>
      changePasswordValidator.validate({ currentPassword: 'old-password', newPassword: 'short' })
    )
  })

  test('rejects a missing currentPassword', async ({ assert }) => {
    await assert.rejects(() =>
      changePasswordValidator.validate({ newPassword: 'new-password-123' })
    )
  })
})

test.group('changeEmailValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await changeEmailValidator.validate({
      currentPassword: 'old-password',
      newEmail: 'new@example.com',
    })
    assert.equal(payload.newEmail, 'new@example.com')
  })

  test('rejects an invalid newEmail', async ({ assert }) => {
    await assert.rejects(() =>
      changeEmailValidator.validate({ currentPassword: 'old-password', newEmail: 'nope' })
    )
  })
})
