import { test } from '@japa/runner'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'

test.group('createCategoryValidator', () => {
  test('accepts a minimal valid payload', async ({ assert }) => {
    const payload = await createCategoryValidator.validate({ name: 'Groceries' })
    assert.equal(payload.name, 'Groceries')
  })

  test('accepts a full payload with all optional fields', async ({ assert }) => {
    const payload = await createCategoryValidator.validate({
      name: 'Groceries',
      color: '#ff0000',
      sortOrder: 3,
    })
    assert.equal(payload.color, '#ff0000')
    assert.equal(payload.sortOrder, 3)
  })

  test('trims the name', async ({ assert }) => {
    const payload = await createCategoryValidator.validate({ name: '  Groceries  ' })
    assert.equal(payload.name, 'Groceries')
  })

  test('rejects a missing name', async ({ assert }) => {
    await assert.rejects(() => createCategoryValidator.validate({}))
  })

  test('rejects an empty name', async ({ assert }) => {
    await assert.rejects(() => createCategoryValidator.validate({ name: '' }))
  })

  test('rejects a name over 80 characters', async ({ assert }) => {
    await assert.rejects(() => createCategoryValidator.validate({ name: 'a'.repeat(81) }))
  })

  test('allows a null color', async ({ assert }) => {
    const payload = await createCategoryValidator.validate({
      name: 'Groceries',
      color: null,
    })
    assert.isNull(payload.color)
  })
})

test.group('updateCategoryValidator', () => {
  test('accepts an empty payload (all fields optional)', async ({ assert }) => {
    const payload = await updateCategoryValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('accepts isActive toggling', async ({ assert }) => {
    const payload = await updateCategoryValidator.validate({ isActive: false })
    assert.equal(payload.isActive, false)
  })

  test('accepts isArchived toggling', async ({ assert }) => {
    const payload = await updateCategoryValidator.validate({ isArchived: true })
    assert.equal(payload.isArchived, true)
  })

  test('rejects an empty-string name when provided', async ({ assert }) => {
    await assert.rejects(() => updateCategoryValidator.validate({ name: '' }))
  })
})
