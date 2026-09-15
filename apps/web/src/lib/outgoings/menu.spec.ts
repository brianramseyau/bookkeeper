import { describe, expect, it, vi } from 'vitest'
import { outgoingMenuActions } from './menu'

describe('outgoingMenuActions', () => {
  it('always leads with Edit', () => {
    const actions = outgoingMenuActions(null, { onEdit: vi.fn(), onLifecycle: vi.fn() })
    expect(actions.map((a) => a.label)).toEqual(['Edit'])
  })

  it('adds the lifecycle transitions for the current state', () => {
    const actions = outgoingMenuActions('active', { onEdit: vi.fn(), onLifecycle: vi.fn() })
    expect(actions.map((a) => a.label)).toEqual(['Edit', 'Pause', 'Archive'])
  })

  it('offers unarchive and delete when archived', () => {
    const actions = outgoingMenuActions('archived', { onEdit: vi.fn(), onLifecycle: vi.fn() })
    expect(actions.map((a) => a.label)).toEqual(['Edit', 'Unarchive', 'Delete'])
  })

  it('invokes the handlers with the chosen action', () => {
    const onEdit = vi.fn()
    const onLifecycle = vi.fn()
    const actions = outgoingMenuActions('paused', { onEdit, onLifecycle })

    actions[0]!.onclick()
    actions[1]!.onclick()

    expect(onEdit).toHaveBeenCalledOnce()
    expect(onLifecycle).toHaveBeenCalledWith('resume')
  })
})
