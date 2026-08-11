import { test } from '@japa/runner'
import { createUtilityValidator, updateUtilityValidator } from '#validators/utility'

test.group('createUtilityValidator', () => {
  test('accepts a minimal valid payload', async ({ assert }) => {
    const payload = await createUtilityValidator.validate({ name: 'Electricity' })
    assert.equal(payload.name, 'Electricity')
  })

  test('accepts a full payload (Water: quarterly, 28-day offset)', async ({ assert }) => {
    const payload = await createUtilityValidator.validate({
      name: 'Water',
      frequency: 'quarterly',
      dueOffsetDays: 28,
    })
    assert.equal(payload.frequency, 'quarterly')
    assert.equal(payload.dueOffsetDays, 28)
  })

  test('accepts a paidInAdvance payload (Phones: annual, paid in advance)', async ({ assert }) => {
    const payload = await createUtilityValidator.validate({
      name: 'Phones',
      frequency: 'annual',
      paidInAdvance: true,
    })
    assert.isTrue(payload.paidInAdvance)
  })

  test('rejects an invalid frequency', async ({ assert }) => {
    await assert.rejects(() =>
      createUtilityValidator.validate({ name: 'Water', frequency: 'weekly' })
    )
  })

  test('rejects a negative dueOffsetDays', async ({ assert }) => {
    await assert.rejects(() =>
      createUtilityValidator.validate({ name: 'Water', dueOffsetDays: -1 })
    )
  })

  test('allows a null dueOffsetDays', async ({ assert }) => {
    const payload = await createUtilityValidator.validate({
      name: 'Water',
      dueOffsetDays: null,
    })
    assert.isNull(payload.dueOffsetDays)
  })

  test('accepts a dueOffsetBusinessDaysOnly payload (Electricity: 13 business days)', async ({
    assert,
  }) => {
    const payload = await createUtilityValidator.validate({
      name: 'Electricity',
      dueOffsetDays: 13,
      dueOffsetBusinessDaysOnly: true,
    })
    assert.isTrue(payload.dueOffsetBusinessDaysOnly)
  })
})

test.group('updateUtilityValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateUtilityValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('accepts toggling isActive', async ({ assert }) => {
    const payload = await updateUtilityValidator.validate({ isActive: false })
    assert.equal(payload.isActive, false)
  })

  test('strips a categoryId from the payload - it is not a settable field', async ({ assert }) => {
    const payload = await updateUtilityValidator.validate({ categoryId: 5 })
    assert.notProperty(payload, 'categoryId')
  })

  test('accepts toggling paidInAdvance', async ({ assert }) => {
    const payload = await updateUtilityValidator.validate({ paidInAdvance: true })
    assert.isTrue(payload.paidInAdvance)
  })

  test('accepts toggling dueOffsetBusinessDaysOnly', async ({ assert }) => {
    const payload = await updateUtilityValidator.validate({ dueOffsetBusinessDaysOnly: true })
    assert.isTrue(payload.dueOffsetBusinessDaysOnly)
  })
})
