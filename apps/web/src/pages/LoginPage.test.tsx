import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginMock = vi.hoisted(() => vi.fn());
const getMeMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>();
  return {
    ...actual,
    login: loginMock,
    getMe: getMeMock,
  };
});

import { ApiError } from '../api/client.ts';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
    getMeMock.mockReset();
  });

  it('renders the sign-in form and the registration link', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /welcome back/i }).textContent
    ).toMatch(/welcome back/i);
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /create an account/i })
        .getAttribute('href')
    ).toBe('/register');
  });

  it('shows the API error envelope when sign-in fails', async () => {
    loginMock.mockRejectedValueOnce(
      new ApiError(401, ['Invalid email or password.'])
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Invalid email or password.');
  });
});
