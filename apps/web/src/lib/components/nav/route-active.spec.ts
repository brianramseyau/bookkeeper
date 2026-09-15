import { describe, expect, it } from 'vitest'
import { isRouteActive } from './route-active'

describe('isRouteActive', () => {
  it('matches the href exactly', () => {
    expect(isRouteActive('/bills', '/bills')).toBe(true)
  })

  it('matches a nested sub-route on a segment boundary', () => {
    expect(isRouteActive('/bills/archive', '/bills')).toBe(true)
  })

  it('does not match a route that merely shares a prefix', () => {
    expect(isRouteActive('/bills-archive', '/bills')).toBe(false)
  })

  it('does not match an unrelated route', () => {
    expect(isRouteActive('/monthly', '/bills')).toBe(false)
  })

  it('matches the root route exactly, without matching every route', () => {
    expect(isRouteActive('/', '/')).toBe(true)
    expect(isRouteActive('/monthly', '/')).toBe(false)
  })
})
