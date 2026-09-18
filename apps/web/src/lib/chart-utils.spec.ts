import { describe, expect, it } from 'vitest'
import { niceDomain, niceMax } from './chart-utils'

describe('niceMax', () => {
  it('returns a fallback scale for zero/negative input', () => {
    expect(niceMax(0)).toEqual({ max: 100, step: 25 })
    expect(niceMax(-5)).toEqual({ max: 100, step: 25 })
  })

  it('rounds the ceiling up to a nice step across four gridlines', () => {
    expect(niceMax(7200)).toEqual({ max: 8000, step: 2000 })
    expect(niceMax(100)).toEqual({ max: 200, step: 50 })
  })

  it('keeps a ceiling that already lands on a nice step', () => {
    expect(niceMax(400)).toEqual({ max: 400, step: 100 })
  })
})

describe('niceDomain', () => {
  it('returns a fallback scale when both bounds are zero', () => {
    expect(niceDomain(0, 0)).toEqual({ min: 0, max: 100, step: 25 })
  })

  it('keeps a zero floor when every value is non-negative', () => {
    expect(niceDomain(0, 340)).toEqual({ min: 0, max: 400, step: 100 })
  })

  it('extends below zero to cover a negative minimum', () => {
    expect(niceDomain(-150, 400)).toEqual({ min: -200, max: 400, step: 200 })
  })

  it('covers an all-negative range while still including zero', () => {
    expect(niceDomain(-320, -50)).toEqual({ min: -400, max: 0, step: 100 })
  })
})
