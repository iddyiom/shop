// Light (Sage) or dark (Deep Blue). The choice is remembered on this browser.
// A theme is not secret, so localStorage is fine here (never for the login token).

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'depot-theme';

/** The saved theme, or light. Storage can be blocked (private window, settings): then light. */
export function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Remember the choice. If storage is blocked, the switch still works for this visit. */
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Nothing to do: not being remembered is fine.
  }
}

/** Switch the colors: every var(--name) in theme.css follows this one attribute. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
