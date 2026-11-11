import { Link } from 'react-router';
import { LogoMark } from './Icons.tsx';

/** Brand mark: the flag's crescent-and-star badge plus the S.I.T wordmark. */
export default function Logo() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white shadow-sm">
        <LogoMark className="h-7 w-7" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight text-ink-900 dark:text-white">
          S.I.T
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500 dark:text-ink-300">
          Study in Tunisia
        </span>
      </span>
    </Link>
  );
}
