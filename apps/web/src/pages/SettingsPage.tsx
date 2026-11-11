import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, changeEmail, changePassword } from '../api/client.ts';
import { loadSession } from '../auth/session.ts';
import PageIllustration from '../components/PageIllustration.tsx';
import Alert, { type AlertTone } from '../components/ui/Alert.tsx';
import Button from '../components/ui/Button.tsx';
import CollapsibleSection from '../components/ui/CollapsibleSection.tsx';
import Field from '../components/ui/Field.tsx';

/**
 * Account settings: password change and email change with
 * re-verification. Both actions are authenticated (the account id
 * comes from the session token, never from the form).
 *
 * Password change: current password must match; the API returns a
 * uniform 401 otherwise.
 *
 * Email change: the account email is updated immediately, isVerified
 * is reset, all sessions are revoked, and a fresh confirmation token
 * is delivered to the NEW address. The user must confirm it before
 * signing in again — the page says so explicitly.
 *
 * Each form lives in a collapsed disclosure so the page is not a wall
 * of always-open inputs. Unauthenticated visits are redirected to
 * /login.
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessages, setPasswordMessages] = useState<string[]>([]);
  const [passwordTone, setPasswordTone] = useState<AlertTone>('error');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailMessages, setEmailMessages] = useState<string[]>([]);
  const [emailTone, setEmailTone] = useState<AlertTone>('error');
  const [emailBusy, setEmailBusy] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }
    setSignedInEmail(session.account.email);
  }, [navigate]);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordTone('error');
      setPasswordMessages(['New passwords do not match.']);
      return;
    }
    setPasswordBusy(true);
    setPasswordMessages([]);
    try {
      await changePassword(session.tokens.accessToken, {
        currentPassword,
        newPassword,
      });
      setPasswordTone('success');
      setPasswordMessages(['Password changed.']);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordTone('error');
      setPasswordMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }
    setEmailBusy(true);
    setEmailMessages([]);
    try {
      const response = await changeEmail(session.tokens.accessToken, {
        newEmail,
      });
      setEmailTone('success');
      setEmailMessages([
        response.message,
        'Check the new inbox and confirm your address before signing in again. Your other sessions have been signed out.',
      ]);
      setNewEmail('');
    } catch (error) {
      setEmailTone('error');
      setEmailMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    } finally {
      setEmailBusy(false);
    }
  }

  if (!signedInEmail) {
    return (
      <div className="relative overflow-hidden">
        <PageIllustration />
        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
          <div className="card p-6 sm:p-8">
            <p className="text-sm text-ink-500 dark:text-ink-300">
              Loading your settings…
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <PageIllustration />

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
            Account settings
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900 dark:text-white">
            Security
          </h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
            Signed in as {signedInEmail}. Changes here apply to this account
            only.
          </p>
        </div>

        <CollapsibleSection
          title="Password"
          description="Change the password you use to sign in."
        >
          <form
            onSubmit={submitPassword}
            className="space-y-4"
            aria-busy={passwordBusy}
          >
            <Alert messages={passwordMessages} tone={passwordTone} />
            <Field
              label="Current password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <Field
              label="New password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              hint="Use at least 8 characters, including a letter and a digit."
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
            <Field
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={passwordBusy}>
                {passwordBusy ? 'Changing…' : 'Change password'}
              </Button>
            </div>
          </form>
        </CollapsibleSection>

        <CollapsibleSection
          title="Email address"
          description="Move your account to a new address; re-verification is required."
          className="mt-6"
        >
          <p className="text-sm text-ink-500 dark:text-ink-300">
            Your new address must confirm before you can sign in again, and all
            other sessions are signed out.
          </p>
          <form
            onSubmit={submitEmail}
            className="mt-4 space-y-4"
            aria-busy={emailBusy}
          >
            <Alert messages={emailMessages} tone={emailTone} />
            <Field
              label="New email"
              name="newEmail"
              type="email"
              autoComplete="email"
              placeholder="new@example.com"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              required
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={emailBusy}>
                {emailBusy ? 'Changing…' : 'Change email'}
              </Button>
            </div>
          </form>
        </CollapsibleSection>
      </section>
    </div>
  );
}
