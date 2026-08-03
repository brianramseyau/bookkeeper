import { beforeEach, describe, expect, it, vi } from 'vitest'
import { replaceState } from '$app/navigation'
import { page } from '$app/state'
import { MonthNav } from './month-nav.svelte'

vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }))

// SvelteKit's real `Page.url` type brands `pathname` with a union of the
// app's known routes - the mock above is a plain URL, so route it through a
// cast here rather than fighting that type at every call site below.
function setPageUrl(url: string) {
  page.url = new URL(url) as unknown as typeof page.url
}

describe('MonthNav', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    setPageUrl('http://localhost/monthly')
    vi.mocked(replaceState).mockReset()
  })

  it('defaults to the current year/month with no query params', () => {
    const nav = new MonthNav('/monthly', vi.fn())
    expect(nav.year).toBe(2026)
    expect(nav.month).toBe(3)
    expect(nav.isCurrentMonth).toBe(true)
  })

  it('reads an initial year/month from the URL query params', () => {
    setPageUrl('http://localhost/monthly?year=2025&month=11')
    const nav = new MonthNav('/monthly', vi.fn())
    expect(nav.year).toBe(2025)
    expect(nav.month).toBe(11)
    expect(nav.isCurrentMonth).toBe(false)
  })

  it('ignores an out-of-range month param', () => {
    setPageUrl('http://localhost/monthly?year=2025&month=13')
    const nav = new MonthNav('/monthly', vi.fn())
    expect(nav.month).toBe(3)
  })

  it('steps forward a month and updates the URL', () => {
    const onChange = vi.fn()
    const nav = new MonthNav('/monthly', onChange)
    nav.changeMonth(1)
    expect(nav.year).toBe(2026)
    expect(nav.month).toBe(4)
    expect(replaceState).toHaveBeenCalledWith('/monthly?year=2026&month=4', {})
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('rolls back over a year boundary', () => {
    setPageUrl('http://localhost/monthly?year=2026&month=1')
    const nav = new MonthNav('/monthly', vi.fn())
    nav.changeMonth(-1)
    expect(nav.year).toBe(2025)
    expect(nav.month).toBe(12)
  })

  it('rolls forward over a year boundary', () => {
    setPageUrl('http://localhost/monthly?year=2026&month=12')
    const nav = new MonthNav('/monthly', vi.fn())
    nav.changeMonth(1)
    expect(nav.year).toBe(2027)
    expect(nav.month).toBe(1)
  })

  it('goToCurrentMonth resets to today and clears the URL', () => {
    setPageUrl('http://localhost/monthly?year=2025&month=11')
    const onChange = vi.fn()
    const nav = new MonthNav('/monthly', onChange)
    nav.goToCurrentMonth()
    expect(nav.year).toBe(2026)
    expect(nav.month).toBe(3)
    expect(replaceState).toHaveBeenCalledWith('/monthly', {})
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('goToCurrentMonth does not touch the URL when already unparameterized', () => {
    setPageUrl('http://localhost/monthly')
    const nav = new MonthNav('/monthly', vi.fn())
    nav.goToCurrentMonth()
    expect(replaceState).not.toHaveBeenCalled()
  })
})
