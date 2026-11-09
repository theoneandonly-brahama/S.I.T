export type AlertTone = 'error' | 'success';

interface AlertProps {
  messages: string[];
  tone?: AlertTone;
}

const TONES: Record<AlertTone, string> = {
  error:
    'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200',
  success:
    'border-sea-500/30 bg-sea-500/10 text-sea-600 dark:border-sea-500/30 dark:bg-sea-500/10 dark:text-sea-500',
};

/**
 * The single alert surface used by every form. Errors are announced
 * assertively; success confirmations are announced politely.
 */
export default function Alert({ messages, tone = 'error' }: AlertProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`}
    >
      <ul className="list-inside list-disc space-y-1">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
