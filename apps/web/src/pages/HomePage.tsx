import { Link } from 'react-router';
import PageIllustration from '../components/PageIllustration.tsx';
import {
  ArrowRightIcon,
  CheckIcon,
  CompassIcon,
  FileTextIcon,
  GlobeIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '../components/ui/Icons.tsx';
import { buttonClass } from '../components/ui/buttonClass.ts';

const FEATURES = [
  {
    title: 'Discover programmes',
    description:
      'Explore universities, fields of study and programme requirements in one structured catalogue.',
    icon: CompassIcon,
  },
  {
    title: 'Apply with confidence',
    description:
      'A guided application flow that shows what is required, what is missing and what comes next.',
    icon: GraduationCapIcon,
  },
  {
    title: 'Scholarships & alternance',
    description:
      'Find funding and work-study opportunities that fit your profile, your goals and your budget.',
    icon: SparklesIcon,
  },
  {
    title: 'Documents in one place',
    description:
      'Upload, manage and reuse your supporting documents without chasing files across email threads.',
    icon: FileTextIcon,
  },
  {
    title: 'Guidance when you need it',
    description:
      'Orientation and counselling support for students and families, at every stage of the journey.',
    icon: GlobeIcon,
  },
  {
    title: 'Built for institutions',
    description:
      'Universities and partners get a clear view of applications and the student journeys behind them.',
    icon: ShieldCheckIcon,
  },
];

const STEPS = [
  {
    title: 'Create your profile',
    description:
      'Tell us about your background, your diploma and the kind of study experience you are looking for.',
  },
  {
    title: 'Explore your options',
    description:
      'Compare programmes, scholarships and alternance opportunities in a single, readable view.',
  },
  {
    title: 'Apply and track',
    description:
      'Submit your application, upload your documents and follow every status change from your dashboard.',
  },
];

const SNAPSHOT = [
  {
    label: 'Profile',
    value: 'Complete',
    icon: CheckIcon,
    tone: 'text-sea-500',
  },
  {
    label: 'Documents',
    value: '2 of 3',
    icon: FileTextIcon,
    tone: 'text-sunset-500',
  },
  {
    label: 'Shortlist',
    value: '4 programmes',
    icon: CompassIcon,
    tone: 'text-brand-500',
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <PageIllustration multiple />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
            <SparklesIcon className="h-3.5 w-3.5" />
            Study in Tunisia · Applications, scholarships, guidance
          </span>

          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl md:text-6xl dark:text-white">
            Your path to studying in Tunisia,{' '}
            <span className="text-gradient">made clear.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg dark:text-ink-300">
            Discover universities and programmes, prepare your application and
            keep every document in one place — built for students and the
            institutions that support them.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register" className={buttonClass('primary')}>
              Create your account
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link to="/login" className={buttonClass('secondary')}>
              Sign in
            </Link>
          </div>

          <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-500 dark:text-ink-300">
            Free for students · Built for universities and partners
          </p>
        </div>

        {/* Product snapshot */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div
            aria-hidden="true"
            className="absolute -inset-x-6 -top-6 bottom-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/10 via-transparent to-sea-500/10 blur-2xl"
          />
          <div className="card overflow-hidden p-2 sm:p-3">
            <div className="rounded-2xl border border-ink-200/70 bg-ink-50/60 p-4 sm:p-6 dark:border-white/10 dark:bg-ink-950/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-300">
                    Application preview
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold text-ink-900 dark:text-white">
                    Your study journey
                  </p>
                </div>
                <span className="rounded-full bg-sea-500/10 px-3 py-1 text-xs font-semibold text-sea-700 dark:text-sea-500">
                  On track
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {SNAPSHOT.map(({ label, value, icon: Icon, tone }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-ink-200/70 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500 dark:text-ink-300">
                        {label}
                      </p>
                      <Icon className={`h-4 w-4 ${tone}`} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink-900 dark:text-white">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-ink-200/70 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                    <GraduationCapIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                      Masters in Computer Science
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-300">
                      Shortlisted · Requirements reviewed
                    </p>
                  </div>
                  <CheckIcon className="h-5 w-5 shrink-0 text-sea-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
            Everything in one place
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl dark:text-white">
            Designed around the student journey
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-500 dark:text-ink-300">
            From the first search to the final confirmation, S.I.T keeps the
            important parts visible and the busywork out of the way.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, description, icon: Icon }) => (
            <div
              key={title}
              className="card p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink-900 dark:text-white">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-300">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-ink-200/70 bg-white/60 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl dark:text-white">
              Three steps from discovery to application
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-500 dark:text-ink-300">
              No scattered tabs, no lost attachments. Each step builds on the
              last, so you always know where you stand.
            </p>
            <Link
              to="/register"
              className={buttonClass('primary', 'md', 'mt-6')}
            >
              Start your journey
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <ol className="space-y-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card flex gap-4 p-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-sm font-semibold text-white dark:bg-white dark:text-ink-900">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-300">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-12 text-center shadow-lg sm:px-12 md:py-16 dark:bg-ink-800">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(197,68,54,0.35),transparent)] blur-2xl"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Ready to start your Tunisian study journey?
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-200">
              Create an account to build your profile, explore programmes and
              keep your applications organised.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register" className={buttonClass('primary')}>
                Create your account
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link to="/login" className={buttonClass('inverse')}>
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
