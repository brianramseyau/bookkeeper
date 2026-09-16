import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { themeState, toggleTheme } from './theme.svelte'

describe('theme store', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
    themeState.current = 'light'
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = '#ffffff'
    document.head.append(meta)
  })

  afterEach(() => {
    document.querySelector('meta[name="theme-color"]')?.remove()
  })

  it('toggles from light to dark, updating the DOM class and localStorage', () => {
    toggleTheme()

    expect(themeState.current).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('toggles from dark back to light', () => {
    toggleTheme()
    toggleTheme()

    expect(themeState.current).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('keeps the theme-color meta in step with the surface token', () => {
    const meta = document.querySelector('meta[name="theme-color"]')

    toggleTheme()
    expect(meta?.getAttribute('content')).toBe('#18201c')

    toggleTheme()
    expect(meta?.getAttribute('content')).toBe('#ffffff')
  })
})

describe('getInitialTheme', () => {
  it('starts dark when the document already has the dark class set', async () => {
    document.documentElement.classList.add('dark')
    vi.resetModules()

    const fresh = await import('./theme.svelte')

    expect(fresh.themeState.current).toBe('dark')
  })
})
