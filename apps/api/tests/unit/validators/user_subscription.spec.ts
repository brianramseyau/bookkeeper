import { test } from '@japa/runner'
import {
  createUserSubscriptionValidator,
  updateUserSubscriptionValidator,
} from '#validators/user_subscription'

test.group('createUserSubscriptionValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await createUserSubscriptionValidator.validate({
      userId: 1,
      name: 'Netflix',
      amount: 22.99,
    })
    assert.equal(payload.name, 'Netflix')
  })

  test('rejects a missing userId', async ({ assert }) => {
    await assert.rejects(() =>
      createUserSubscriptionValidator.validate({ name: 'Netflix', amount: 22.99 })
    )
  })

  test('rejects a dayOfMonth outside 1-31', async ({ assert }) => {
    await assert.rejects(() =>
      createUserSubscriptionValidator.validate({
        userId: 1,
        name: 'Netflix',
        amount: 22.99,
        dayOfMonth: 32,
      })
    )
  })

  test('allows a null dayOfMonth', async ({ assert }) => {
    const payload = await createUserSubscriptionValidator.validate({
      userId: 1,
      name: 'Netflix',
      amount: 22.99,
      dayOfMonth: null,
    })
    assert.isNull(payload.dayOfMonth)
  })
})

test.group('updateUserSubscriptionValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateUserSubscriptionValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('accepts toggling includeInStandardMonth', async ({ assert }) => {
    const payload = await updateUserSubscriptionValidator.validate({
      includeInStandardMonth: false,
    })
    assert.equal(payload.includeInStandardMonth, false)
  })
})
