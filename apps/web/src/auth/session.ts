// Minimal session persistence for the prototype: tokens keep working
// across SPA route changes within the same tab but never reach disk
// (sessionStorage). Note the trade-off: refresh tokens in
// web-accessible storage are exposed to XSS; a hardened design would
// move storage server-side (httpOnly cookies) — recorded as a
// hardening item, not a prototype blocker.
import type { AccountResponse, AuthTokens } from '@sit/contract';

const STORAGE_KEY = 'sit.session';

export interface StoredSession {
  account: AccountResponse;
  tokens: AuthTokens;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.account?.email !== 'string' ||
      typeof parsed.tokens?.accessToken !== 'string'
    ) {
      // Shape drift or tampered storage: reset rather than trust.
      clearSession();
      return null;
    }
    return parsed as StoredSession;
  } catch {
    // Unparseable JSON: same treatment as a missing session.
    clearSession();
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
