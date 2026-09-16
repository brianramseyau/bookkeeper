import { describe, expect, it } from 'vitest'
import { byName, byValueAsc, byValueDesc } from './sort'

interface Row {
  name: string
  value: number | null
}

describe('byName', () => {
  it('compares case-insensitively', () => {
    const rows: Row[] = [
      { name: 'banana', value: 1 },
      { name: 'Apple', value: 2 },
      { name: 'cherry', value: 3 },
    ]
    expect([...rows].sort(byName).map((row) => row.name)).toEqual(['Apple', 'banana', 'cherry'])
  })
})

describe('byValueDesc', () => {
  const compare = byValueDesc<Row>((row) => row.value)

  it('orders high to low with missing values last', () => {
    const rows: Row[] = [
      { name: 'a', value: 5 },
      { name: 'b', value: null },
      { name: 'c', value: 10 },
    ]
    expect([...rows].sort(compare).map((row) => row.name)).toEqual(['c', 'a', 'b'])
  })

  it('keeps two missing values in their existing order', () => {
    const rows: Row[] = [
      { name: 'a', value: null },
      { name: 'b', value: null },
    ]
    expect([...rows].sort(compare).map((row) => row.name)).toEqual(['a', 'b'])
  })
})

describe('byValueAsc', () => {
  it('orders numbers low to high with missing values last', () => {
    const compare = byValueAsc<Row>((row) => row.value)
    const rows: Row[] = [
      { name: 'a', value: 5 },
      { name: 'b', value: null },
      { name: 'c', value: 2 },
    ]
    expect([...rows].sort(compare).map((row) => row.name)).toEqual(['c', 'a', 'b'])
  })

  it('orders ISO date strings chronologically', () => {
    const compare = byValueAsc<{ name: string; due: string | null }>((row) => row.due)
    const rows = [
      { name: 'a', due: '2026-05-01' },
      { name: 'b', due: null },
      { name: 'c', due: '2026-01-15' },
    ]
    expect([...rows].sort(compare).map((row) => row.name)).toEqual(['c', 'a', 'b'])
  })

  it('keeps two missing values in their existing order', () => {
    const compare = byValueAsc<Row>((row) => row.value)
    const rows: Row[] = [
      { name: 'a', value: null },
      { name: 'b', value: null },
    ]
    expect([...rows].sort(compare).map((row) => row.name)).toEqual(['a', 'b'])
  })
})
