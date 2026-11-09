import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { logout } from '../api/client.ts';
import type { StoredSession } from '../auth/session.ts';
import { clearSession, loadSession } from '../auth/session.ts';
import { CloseIcon, MenuIcon } from './ui/Icons.tsx';
import Logo from './ui/Logo.tsx';
import ThemeToggle from './ui/ThemeToggle.tsx';
import { buttonClass } from './ui/buttonClass.ts';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/profile', label: 'Profile', end: false },
  { to: '/uploads', label: 'Documents', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-white',
  ].join(' ');
}

/**
 * Application shell: a floating navigation bar, the page outlet and a
 * quiet footer. Signed-in state is re-read on navigation, so pages can
 * simply call `navigate()` after login/logout.
 */
export default function Layout() {
  const [session, setSession] = useState<StoredSession | null>(() =>
    loadSession()
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    setSession(loadSession());
  }, []);

  useEffect(() => {
    refresh();
    setMenuOpen(false);
  }, [location, refresh]);

  async function handleLogout() {
    if (session) {
      try {
        // The API's logout is idempotent; a network failure must never
        // trap the user in a "signed in" UI state.
        await logout(session.tokens.accessToken, session.tokens.refreshToken);
      } catch {
        // Swallowed deliberately — local state is cleared regardless.
      }
      clearSession();
      refresh();
      setMenuOpen(false);
      navigate('/');
    }
  }

  return (
    <div className="flex min-h-screen flex-col text-ink-900 transition-colors dark:text-ink-100">
      <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 rounded-2xl border border-ink-200/70 bg-white/85 px-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-ink-900/70">
          <Logo />

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navLinkClass}
              >
                {item.label}
              </NavLink>
            ))}

            <span
              className="mx-1 h-6 w-px bg-ink-200 dark:bg-white/10"
              aria-hidden="true"
            />

            {session ? (
              <>
                <span className="hidden max-w-[170px] truncate text-xs text-ink-500 lg:inline dark:text-ink-300">
                  {session.account.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={buttonClass('secondary', 'sm')}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonClass('ghost', 'sm')}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonClass('primary', 'sm')}>
                  Get started
                </Link>
              </>
            )}

            <ThemeToggle />
          </nav>

          <div className="flex items-center gap-1.5 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-white/10"
            >
              {menuOpen ? (
                <CloseIcon className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="mobile-nav"
            className="mx-auto mt-2 max-w-6xl rounded-2xl border border-ink-200/70 bg-white p-3 shadow-lg md:hidden dark:border-white/10 dark:bg-ink-900"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-3 border-t border-ink-200 pt-3 dark:border-white/10">
              {session ? (
                <div className="flex flex-col gap-2">
                  <span className="truncate text-xs text-ink-500 dark:text-ink-300">
                    Signed in as {session.account.email}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={buttonClass('secondary', 'sm', 'w-full')}
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    className={buttonClass('secondary', 'sm', 'w-full')}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className={buttonClass('primary', 'sm', 'w-full')}
                  >
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200/70 py-8 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-ink-500 sm:flex-row sm:px-6 dark:text-ink-400">
          <p>© {new Date().getFullYear()} S.I.T — Study In Tunisia</p>
          <p>Built for students, universities and partners in Tunisia.</p>
        </div>
      </footer>
    </div>
  );
}
