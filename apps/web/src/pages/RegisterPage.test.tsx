import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, loadSession } from '../auth/session.ts';

const registerMock = vi.hoisted(() => vi.fn());
const resendMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>();
  return {
    ...actual,
    register: registerMock,
    resendConfirmation: resendMock,
  };
});

import RegisterPage from './RegisterPage';

describe('RegisterPage', () => {
  beforeEach(() => {
    registerMock.mockReset();
    resendMock.mockReset();
    clearSession();
  });

  it('renders the registration form with password confirmation', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /create your account/i }).textContent
    ).toMatch(/create your account/i);
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^confirm password$/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^create account$/i })
    ).toBeTruthy();
  });

  it('rejects mismatched passwords before calling the API', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'Str0ngPass!23' },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: 'DifferentPass!23' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Passwords do not match.');
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('shows the confirmation step after registration without creating a session', async () => {
    registerMock.mockResolvedValue({
      account: { email: 'student@example.com' },
      confirmation: {
        token: 'confirm-token',
        expiresAt: new Date().toISOString(),
      },
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'Str0ngPass!23' },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: 'Str0ngPass!23' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(
      await screen.findByRole('heading', { name: /check your email/i })
    ).toBeTruthy();
    expect(screen.getByText(/student@example\.com/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /confirm email/i })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /resend confirmation email/i })
    ).toBeTruthy();
    expect(loadSession()).toBeNull();
  });

  it('resends the confirmation email with the registered address and shows the generic message', async () => {
    registerMock.mockResolvedValue({
      account: { email: 'student@example.com' },
      confirmation: {
        token: 'confirm-token',
        expiresAt: new Date().toISOString(),
      },
    });
    resendMock.mockResolvedValue({
      message:
        'If an unverified account exists for this address, a confirmation token has been issued.',
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'Str0ngPass!23' },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: 'Str0ngPass!23' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    fireEvent.click(
      await screen.findByRole('button', { name: /resend confirmation email/i })
    );

    await waitFor(() => {
      expect(resendMock).toHaveBeenCalledWith({
        email: 'student@example.com',
      });
    });
    expect(
      await screen.findByText(/confirmation token has been issued/i)
    ).toBeTruthy();
  });
});
