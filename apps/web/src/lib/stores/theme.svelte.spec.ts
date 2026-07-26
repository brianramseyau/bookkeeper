import { beforeEach, describe, expect, it, vi } from 'vitest'
import { themeState, toggleTheme } from './theme.svelte'

describe('theme store', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
    themeState.current = 'light'
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
})

describe('getInitialTheme', () => {
  it('starts dark when the document already has the dark class set', async () => {
    document.documentElement.classList.add('dark')
    vi.resetModules()

    const fresh = await import('./theme.svelte')

    expect(fresh.themeState.current).toBe('dark')
  })
})
