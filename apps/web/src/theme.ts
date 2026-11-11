/**
 * Light/dark theme persistence.
 *
 * The theme is expressed as a `data-theme` attribute on <html>, which is
 * what the Tailwind `dark` variant keys off. Reading and writing the
 * attribute (rather than relying only on `prefers-color-scheme`) keeps
 * the choice explicit and instant for the user.
 */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sit-theme';

/** Stored choice wins; otherwise follow the operating system. */
export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Storage can be unavailable (private mode, policy). Falling back to
    // the OS preference is still a usable experience.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Persisting is a convenience, not a requirement for correctness.
  }
}
