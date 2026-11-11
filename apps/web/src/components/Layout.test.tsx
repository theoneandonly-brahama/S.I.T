import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sessionState = vi.hoisted(() => ({
  current: null as null | {
    account: { id: string; email: string };
    tokens: { accessToken: string; refreshToken: string };
  },
}));

const logoutMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>();
  return { ...actual, logout: logoutMock };
});

vi.mock('../auth/session.ts', () => ({
  loadSession: () => sessionState.current,
  clearSession: () => {
    sessionState.current = null;
  },
}));

import Layout from './Layout';

const SESSION = {
  account: { id: '1', email: 'student@example.com' },
  tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
};

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<p>Home page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Layout navigation', () => {
  beforeEach(() => {
    // ThemeToggle reads this attribute first; without it, jsdom's
    // missing matchMedia would be hit by the OS-preference fallback.
    document.documentElement.dataset.theme = 'light';
    sessionState.current = null;
    logoutMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it('shows only Get started to anonymous visitors', () => {
    renderLayout();

    const links = screen.getAllByRole('link', { name: /get started/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/register');
    }

    expect(screen.queryByRole('link', { name: /^sign in$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^profile$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^documents$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^settings$/i })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /switch to .* mode/i })
    ).toBeNull();
  });

  it('keeps account links and the theme switch inside the email menu', () => {
    sessionState.current = SESSION;
    renderLayout();

    expect(screen.queryByRole('link', { name: /^profile$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^documents$/i })).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: /student@example.com/i })
    );

    expect(
      screen.getByRole('link', { name: /^profile$/i }).getAttribute('href')
    ).toBe('/profile');
    expect(
      screen.getByRole('link', { name: /^settings$/i }).getAttribute('href')
    ).toBe('/settings');
    expect(screen.queryByRole('link', { name: /^documents$/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: /switch to .* mode/i })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
  });

  it('logs out from the email menu', async () => {
    sessionState.current = SESSION;
    renderLayout();

    fireEvent.click(
      screen.getByRole('button', { name: /student@example.com/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
    });
    expect(sessionState.current).toBeNull();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /student@example.com/i })
      ).toBeNull();
    });
  });
});
