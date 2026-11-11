import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const changePasswordMock = vi.hoisted(() => vi.fn());
const changeEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>();
  return {
    ...actual,
    changePassword: changePasswordMock,
    changeEmail: changeEmailMock,
  };
});

vi.mock('../auth/session.ts', () => ({
  loadSession: () => ({
    account: { id: '1', email: 'student@example.com' },
    tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
  }),
}));

import { ApiError } from '../api/client.ts';
import SettingsPage from './SettingsPage';

function renderPage() {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  );
}

function openPassword() {
  fireEvent.click(screen.getByRole('button', { name: /^password/i }));
}

function openEmail() {
  fireEvent.click(screen.getByRole('button', { name: /^email address/i }));
}

describe('SettingsPage', () => {
  beforeEach(() => {
    changePasswordMock.mockReset();
    changeEmailMock.mockReset();
  });

  it('starts collapsed and reveals each form on demand', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /^security$/i })).toBeTruthy();
    expect(screen.getByText(/signed in as student@example\.com/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^current password$/i)).toBeNull();
    expect(screen.queryByLabelText(/^new email$/i)).toBeNull();

    openPassword();
    expect(screen.getByLabelText(/^current password$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^new password$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^confirm new password$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^new email$/i)).toBeNull();

    openEmail();
    expect(screen.getByLabelText(/^new email$/i)).toBeTruthy();
  });

  it('shows a client error when the new passwords do not match and does not call the API', async () => {
    renderPage();
    openPassword();

    fireEvent.change(screen.getByLabelText(/^current password$/i), {
      target: { value: 'OldPass1!' },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: 'NewPass2!' },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
      target: { value: 'Mismatch9!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^change password$/i }));

    expect(await screen.findByText(/new passwords do not match/i)).toBeTruthy();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('submits the password change with the session token and confirms success', async () => {
    changePasswordMock.mockResolvedValueOnce({ success: true });
    renderPage();
    openPassword();

    fireEvent.change(screen.getByLabelText(/^current password$/i), {
      target: { value: 'OldPass1!' },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: 'NewPass2!' },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
      target: { value: 'NewPass2!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^change password$/i }));

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith('access-token', {
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass2!',
      });
    });
    expect(await screen.findByText(/password changed/i)).toBeTruthy();
  });

  it('shows the uniform API error when the current password is wrong', async () => {
    changePasswordMock.mockRejectedValueOnce(
      new ApiError(401, ['Invalid credentials.'])
    );
    renderPage();
    openPassword();

    fireEvent.change(screen.getByLabelText(/^current password$/i), {
      target: { value: 'WrongPass9!' },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: 'NewPass2!' },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
      target: { value: 'NewPass2!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^change password$/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeTruthy();
  });

  it('submits the email change and explains re-verification', async () => {
    changeEmailMock.mockResolvedValueOnce({
      message:
        'If an unverified account exists for this address, a confirmation token has been issued.',
    });
    renderPage();
    openEmail();

    fireEvent.change(screen.getByLabelText(/^new email$/i), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^change email$/i }));

    await waitFor(() => {
      expect(changeEmailMock).toHaveBeenCalledWith('access-token', {
        newEmail: 'new@example.com',
      });
    });
    expect(
      await screen.findByText(/confirmation token has been issued/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/confirm your address before signing in again/i)
    ).toBeTruthy();
  });
});
