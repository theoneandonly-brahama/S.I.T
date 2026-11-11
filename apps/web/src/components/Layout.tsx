import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { logout } from '../api/client.ts';
import type { StoredSession } from '../auth/session.ts';
import { clearSession, loadSession } from '../auth/session.ts';
import { ChevronDownIcon, CloseIcon, MenuIcon } from './ui/Icons.tsx';
import Logo from './ui/Logo.tsx';
import ThemeToggle from './ui/ThemeToggle.tsx';
import { buttonClass } from './ui/buttonClass.ts';

const PUBLIC_NAV_ITEMS = [{ to: '/', label: 'Home', end: true }];

const ACCOUNT_NAV_ITEMS = [
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-white',
  ].join(' ');
}

function accountLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-white',
  ].join(' ');
}

const accountButtonClass =
  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-white';

const accountPanelClass =
  'absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-ink-200/70 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-ink-900';

const accountLogoutClass =
  'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-white';

/**
 * Application shell: a floating navigation bar, the page outlet and a
 * quiet footer. Signed-in state is re-read on navigation, so pages can
 * simply call `navigate()` after login/logout.
 *
 * The navigation only exposes public links to anonymous visitors. Once
 * signed in, account links and the theme switch live in a collapsible
 * menu under the account email.
 */
export default function Layout() {
  const [session, setSession] = useState<StoredSession | null>(() =>
    loadSession()
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const desktopAccountRef = useRef<HTMLDivElement>(null);
  const mobileAccountRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    setSession(loadSession());
  }, []);

  useEffect(() => {
    refresh();
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location, refresh]);

  // Close the account menu on an outside click or Escape. Both the
  // desktop and mobile panels are checked so either trigger behaves.
  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !desktopAccountRef.current?.contains(target) &&
        !mobileAccountRef.current?.contains(target)
      ) {
        setAccountOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountOpen]);

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
      setAccountOpen(false);
      navigate('/');
    }
  }

  return (
    <div className="flex min-h-screen flex-col text-ink-900 transition-colors dark:text-ink-100">
      <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 rounded-2xl border border-ink-200 bg-white/95 px-4 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-ink-900/70 dark:shadow-sm">
          <Logo />

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary"
          >
            {PUBLIC_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navLinkClass}
              >
                {item.label}
              </NavLink>
            ))}

            {session ? (
              <div className="relative" ref={desktopAccountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-expanded={accountOpen}
                  aria-controls={
                    accountOpen ? 'account-menu-desktop' : undefined
                  }
                  className={accountButtonClass}
                >
                  <span className="max-w-[180px] truncate">
                    {session.account.email}
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {accountOpen && (
                  <div
                    id="account-menu-desktop"
                    role="group"
                    aria-label="Account"
                    className={accountPanelClass}
                  >
                    {ACCOUNT_NAV_ITEMS.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={accountLinkClass}
                      >
                        {item.label}
                      </NavLink>
                    ))}

                    <div
                      className="my-2 h-px bg-ink-200 dark:bg-white/10"
                      aria-hidden="true"
                    />

                    <div className="flex items-center justify-between rounded-xl px-3 py-1.5">
                      <span className="text-sm font-medium text-ink-700 dark:text-ink-200">
                        Theme
                      </span>
                      <ThemeToggle />
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className={accountLogoutClass}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/register" className={buttonClass('primary', 'sm')}>
                Get started
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-1.5 md:hidden">
            {session ? (
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? 'mobile-nav' : undefined}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-white/10"
              >
                {menuOpen ? (
                  <CloseIcon className="h-5 w-5" />
                ) : (
                  <MenuIcon className="h-5 w-5" />
                )}
              </button>
            ) : (
              <Link to="/register" className={buttonClass('primary', 'sm')}>
                Get started
              </Link>
            )}
          </div>
        </div>

        {session && menuOpen && (
          <div
            id="mobile-nav"
            className="mx-auto mt-2 max-w-6xl rounded-2xl border border-ink-200/70 bg-white p-3 shadow-lg md:hidden dark:border-white/10 dark:bg-ink-900"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {PUBLIC_NAV_ITEMS.map((item) => (
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

            <div
              className="mt-3 border-t border-ink-200 pt-3 dark:border-white/10"
              ref={mobileAccountRef}
            >
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-controls={accountOpen ? 'account-menu-mobile' : undefined}
                className={`${accountButtonClass} w-full justify-between`}
              >
                <span className="truncate">{session.account.email}</span>
                <ChevronDownIcon
                  className={`h-4 w-4 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {accountOpen && (
                <div
                  id="account-menu-mobile"
                  role="group"
                  aria-label="Account"
                  className="mt-2 rounded-xl border border-ink-200/70 p-2 dark:border-white/10"
                >
                  {ACCOUNT_NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={accountLinkClass}
                    >
                      {item.label}
                    </NavLink>
                  ))}

                  <div
                    className="my-2 h-px bg-ink-200 dark:bg-white/10"
                    aria-hidden="true"
                  />

                  <div className="flex items-center justify-between rounded-xl px-3 py-1.5">
                    <span className="text-sm font-medium text-ink-700 dark:text-ink-200">
                      Theme
                    </span>
                    <ThemeToggle />
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className={accountLogoutClass}
                  >
                    Log out
                  </button>
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
