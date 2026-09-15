import { describe, expect, it } from 'vitest'
import {
  groupByLifecycle,
  lifecycleActions,
  lifecyclePatch,
  lifecycleState,
  type LifecycleFlags,
} from './lifecycle'

function flags(overrides: Partial<LifecycleFlags> = {}): LifecycleFlags {
  return { isActive: true, isPaused: false, isArchived: false, ...overrides }
}

describe('lifecycleState', () => {
  it('is active when nothing is set', () => {
    expect(lifecycleState(flags())).toBe('active')
  })

  it('is paused when only isPaused is set', () => {
    expect(lifecycleState(flags({ isPaused: true }))).toBe('paused')
  })

  it('is archived when only isArchived is set', () => {
    expect(lifecycleState(flags({ isArchived: true }))).toBe('archived')
  })

  it('is removed when isActive is false, even if paused or archived', () => {
    expect(lifecycleState(flags({ isActive: false }))).toBe('removed')
    expect(lifecycleState(flags({ isActive: false, isPaused: true }))).toBe('removed')
    expect(lifecycleState(flags({ isActive: false, isArchived: true }))).toBe('removed')
  })

  it('treats a missing pause/archive flag as false (utilities)', () => {
    expect(lifecycleState({ isActive: true })).toBe('active')
  })
})

describe('lifecycleActions', () => {
  it('offers pause and archive for an active item', () => {
    expect(lifecycleActions('active')).toEqual(['pause', 'archive'])
  })

  it('offers resume and archive for a paused item', () => {
    expect(lifecycleActions('paused')).toEqual(['resume', 'archive'])
  })

  it('offers unarchive and delete for an archived item', () => {
    expect(lifecycleActions('archived')).toEqual(['unarchive', 'delete'])
  })

  it('offers only restore for a removed item', () => {
    expect(lifecycleActions('removed')).toEqual(['restore'])
  })
})

describe('lifecyclePatch', () => {
  it('maps each action to its API flag change', () => {
    expect(lifecyclePatch('pause')).toEqual({ isPaused: true })
    expect(lifecyclePatch('resume')).toEqual({ isPaused: false })
    expect(lifecyclePatch('archive')).toEqual({ isArchived: true })
    expect(lifecyclePatch('unarchive')).toEqual({ isArchived: false })
    expect(lifecyclePatch('restore')).toEqual({ isActive: true })
  })

  it('maps delete to no field change (it uses the DELETE route)', () => {
    expect(lifecyclePatch('delete')).toEqual({})
  })
})

describe('groupByLifecycle', () => {
  it('splits items into all four states in a stable order, including empty groups', () => {
    const groups = groupByLifecycle([
      { id: 1, ...flags() },
      { id: 2, ...flags({ isPaused: true }) },
      { id: 3, ...flags({ isArchived: true }) },
      { id: 4, ...flags({ isActive: false }) },
    ])

    expect(groups.map((g) => g.state)).toEqual(['active', 'paused', 'archived', 'removed'])
    expect(groups.map((g) => g.label)).toEqual(['Active', 'Paused', 'Archived', 'Removed'])
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([[1], [2], [3], [4]])
  })
})
