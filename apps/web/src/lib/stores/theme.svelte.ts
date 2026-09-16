export type Theme = 'light' | 'dark'

// Matches the `--surface` brand token in layout.css, which the app shell's nav
// bar sits on - keeps the browser/PWA chrome (theme-color) in step with it.
const THEME_COLOR: Record<Theme, string> = { light: '#ffffff', dark: '#18201c' }

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  // The inline script in app.html already set this class before hydration,
  // so read it back rather than re-deriving from localStorage/media query.
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyThemeColor(theme: Theme): void {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme])
}

class ThemeState {
  current = $state<Theme>(getInitialTheme())
}

export const themeState = new ThemeState()

export function toggleTheme(): void {
  themeState.current = themeState.current === 'dark' ? 'light' : 'dark'
  document.documentElement.classList.toggle('dark', themeState.current === 'dark')
  applyThemeColor(themeState.current)
  localStorage.setItem('theme', themeState.current)
}
