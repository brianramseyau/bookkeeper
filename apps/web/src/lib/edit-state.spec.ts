import { describe, expect, it } from 'vitest'
import { createEditState } from './edit-state.svelte'

describe('EditState', () => {
  it('starts with nothing being edited', () => {
    const state = createEditState<number, { amount: number }>()
    expect(state.isEditing).toBe(false)
    expect(state.key).toBeNull()
    expect(state.form).toBeNull()
  })

  it('start() sets the key and draft form', () => {
    const state = createEditState<number, { amount: number }>()
    state.start(1, { amount: 42 })
    expect(state.isEditing).toBe(true)
    expect(state.isEditingKey(1)).toBe(true)
    expect(state.isEditingKey(2)).toBe(false)
    expect(state.form).toEqual({ amount: 42 })
  })

  it('cancel() clears the key and form', () => {
    const state = createEditState<number, { amount: number }>()
    state.start(1, { amount: 42 })
    state.cancel()
    expect(state.isEditing).toBe(false)
    expect(state.key).toBeNull()
    expect(state.form).toBeNull()
  })

  it('saving defaults to false and can be toggled independently', () => {
    const state = createEditState<true, { amount: number }>()
    expect(state.saving).toBe(false)
    state.saving = true
    expect(state.saving).toBe(true)
  })
})
