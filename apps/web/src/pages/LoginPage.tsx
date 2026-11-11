import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, getMe, login } from '../api/client.ts';
import { saveSession, type StoredSession } from '../auth/session.ts';
import PageIllustration from '../components/PageIllustration.tsx';
import Alert from '../components/ui/Alert.tsx';
import Button from '../components/ui/Button.tsx';
import Field from '../components/ui/Field.tsx';
import { StarIcon } from '../components/ui/Icons.tsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessages([]);
    try {
      const tokens = await login({ email, password });
      const account = await getMe(tokens.accessToken);
      const stored: StoredSession = { account, tokens };
      saveSession(stored);
      navigate('/profile');
    } catch (error) {
      setMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    } finally {
      setBusy(false);
    }
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
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
                Sign in to continue your application journey.
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
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <Button type="submit" block disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-3 text-center text-xs text-ink-500 dark:text-ink-300">
              Just registered? Confirm your email before signing in.
            </p>

            <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-300">
              New to S.I.T?{' '}
              <Link
                to="/register"
                className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
              >
                Create an account
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-ink-500 dark:text-ink-300">
            Your session stays in this tab and is cleared when you sign out.
          </p>
        </div>
      </section>
    </div>
  );
}
