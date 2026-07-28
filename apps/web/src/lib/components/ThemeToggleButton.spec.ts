import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { themeState } from '$lib/stores/theme.svelte'
import ThemeToggleButton from './ThemeToggleButton.svelte'

afterEach(() => {
  themeState.current = 'light'
})

describe('ThemeToggleButton', () => {
  it('shows the sun icon path in light mode', () => {
    themeState.current = 'light'
    const { container } = render(ThemeToggleButton)
    expect(container.querySelector('path')?.getAttribute('d')).toContain('M17.293 13.293')
  })

  it('shows the moon icon path in dark mode', () => {
    themeState.current = 'dark'
    const { container } = render(ThemeToggleButton)
    expect(container.querySelector('path')?.getAttribute('d')).toContain('M10 2a.75.75')
  })

  it('toggles the theme when clicked', async () => {
    themeState.current = 'light'
    const { getByLabelText } = render(ThemeToggleButton)
    await fireEvent.click(getByLabelText('Toggle dark mode'))
    expect(themeState.current).toBe('dark')
  })

  it('applies the requested padding', () => {
    const { container } = render(ThemeToggleButton, { padding: 'p-2.5' })
    expect(container.querySelector('button')?.className).toContain('p-2.5')
  })
})
