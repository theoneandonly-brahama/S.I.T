import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { RegistrationConfirmation } from '@sit/contract';
import { ApiError, register, resendConfirmation, verifyEmail } from '../api/client.ts';
import PageIllustration from '../components/PageIllustration.tsx';
import Alert from '../components/ui/Alert.tsx';
import Button from '../components/ui/Button.tsx';
import Field from '../components/ui/Field.tsx';
import { StarIcon } from '../components/ui/Icons.tsx';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] =
    useState<RegistrationConfirmation | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMessages, setVerifyMessages] = useState<string[]>([]);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessages, setResendMessages] = useState<string[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessages([]);

    // Client-side check for a mistake the API cannot see. Server-side
    // validation still runs and remains the source of truth.
    if (password !== confirmPassword) {
      setMessages(['Passwords do not match.']);
      return;
    }

    setBusy(true);
    try {
      const response = await register({ email, password });
      setRegisteredEmail(response.account.email);
      setConfirmation(response.confirmation);
    } catch (error) {
      setMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmEmail() {
    if (!confirmation) {
      return;
    }

    setVerifyBusy(true);
    setVerifyMessages([]);
    try {
      await verifyEmail(confirmation.token);
      setVerified(true);
    } catch (error) {
      setVerifyMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    } finally {
      setVerifyBusy(false);
    }
  }

  async function resendEmail() {
    setResendBusy(true);
    setResendMessages([]);
    try {
      const response = await resendConfirmation({ email: registeredEmail });
      setResendMessages([response.message]);
    } catch (error) {
      setResendMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    } finally {
      setResendBusy(false);
    }
  }

  if (confirmation) {
    return (
      <div className="relative overflow-hidden">
        <PageIllustration multiple />

        <section className="mx-auto flex max-w-6xl justify-center px-4 py-14 sm:px-6 md:py-20">
          <div className="w-full max-w-md">
            <div className="card p-6 sm:p-8">
              <div className="text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                  <StarIcon className="h-3.5 w-3.5" />
                  Study in Tunisia
                </span>
                <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-900 dark:text-white">
                  {verified ? 'Email confirmed' : 'Check your email'}
                </h1>
                <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
                  {verified
                    ? 'Your account is active. You can sign in now.'
                    : `We created the account for ${registeredEmail}. Confirm it to activate the account.`}
                </p>
              </div>

              {!verified && (
                <div className="mt-6 space-y-4">
                  <Alert messages={verifyMessages} />
                  <p className="text-sm text-ink-500 dark:text-ink-300">
                    No email provider is configured in this environment, so the
                    confirmation step is available directly here.
                  </p>
                  <Button
                    type="button"
                    block
                    disabled={verifyBusy}
                    onClick={confirmEmail}
                  >
                    {verifyBusy ? 'Confirming…' : 'Confirm email'}
                  </Button>
                  <Alert messages={resendMessages} />
                  <Button
                    type="button"
                    variant="secondary"
                    block
                    disabled={resendBusy}
                    onClick={resendEmail}
                  >
                    {resendBusy
                      ? 'Resending…'
                      : 'Resend confirmation email'}
                  </Button>
                </div>
              )}

              <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-300">
                {verified ? (
                  <Link
                    to="/login"
                    className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
                  >
                    Sign in
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
                  >
                    Back to sign in
                  </Link>
                )}
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <PageIllustration multiple />

      <section className="mx-auto flex max-w-6xl justify-center px-4 py-14 sm:px-6 md:py-20">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                <StarIcon className="h-3.5 w-3.5" />
                Study in Tunisia
              </span>
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-900 dark:text-white">
                Create your account
              </h1>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
                Start building your profile and explore your options.
              </p>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4" aria-busy={busy}>
              <Alert messages={messages} />

              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                hint="Use at least 8 characters."
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />

              <Field
                label="Confirm password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />

              <Button type="submit" block disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-300">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
              >
                Sign in
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-ink-500 dark:text-ink-300">
            Your account stays inactive until you confirm your email.
          </p>
        </div>
      </section>
    </div>
  );
}
