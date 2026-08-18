import { describe, expect, it } from 'vitest'
import { niceMax } from './chart-utils'

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
