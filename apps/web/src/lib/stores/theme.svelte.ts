export type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  // The inline script in app.html already set this class before hydration,
  // so read it back rather than re-deriving from localStorage/media query.
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

class ThemeState {
  current = $state<Theme>(getInitialTheme())
}

export const themeState = new ThemeState()

export function toggleTheme(): void {
  themeState.current = themeState.current === 'dark' ? 'light' : 'dark'
  document.documentElement.classList.toggle('dark', themeState.current === 'dark')
  localStorage.setItem('theme', themeState.current)
}
