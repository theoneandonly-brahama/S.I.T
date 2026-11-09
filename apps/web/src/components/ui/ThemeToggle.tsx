import { useEffect, useState } from 'react';
import {
  applyTheme,
  persistTheme,
  readTheme,
  type Theme,
} from '../../theme.ts';
import { MoonIcon, SunIcon } from './Icons.tsx';

/**
 * Light/dark switch. The initial value is read from the attribute that
 * `main.tsx` set before the first render, so there is no flash of the
 * wrong theme.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const current = document.documentElement.dataset.theme;
    return current === 'light' || current === 'dark' ? current : readTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const next = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-ink-200 dark:hover:bg-white/10"
    >
      {theme === 'light' ? (
        <MoonIcon className="h-4 w-4" />
      ) : (
        <SunIcon className="h-4 w-4" />
      )}
    </button>
  );
}
