import { describe, expect, it } from 'vitest'
import { reorderedSortOrders } from './dnd'

describe('reorderedSortOrders', () => {
  it('returns no updates when the order is unchanged', () => {
    const items = [
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 1 },
      { id: 3, sortOrder: 2 },
    ]
    expect(reorderedSortOrders(items)).toEqual([])
  })

  it('reassigns the same pool of sortOrder values to the new positions', () => {
    // item 3 dragged from the end to the front
    const items = [
      { id: 3, sortOrder: 2 },
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 1 },
    ]
    expect(reorderedSortOrders(items)).toEqual([
      { id: 3, sortOrder: 0 },
      { id: 1, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ])
  })

  it('only returns entries whose sortOrder actually changed', () => {
    const items = [
      { id: 1, sortOrder: 0 },
      { id: 3, sortOrder: 2 },
      { id: 2, sortOrder: 1 },
    ]
    expect(reorderedSortOrders(items)).toEqual([
      { id: 3, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ])
  })

  it('works with a non-contiguous sortOrder pool (a filtered subgroup)', () => {
    const items = [
      { id: 5, sortOrder: 10 },
      { id: 2, sortOrder: 3 },
    ]
    expect(reorderedSortOrders(items)).toEqual([
      { id: 5, sortOrder: 3 },
      { id: 2, sortOrder: 10 },
    ])
  })
})
