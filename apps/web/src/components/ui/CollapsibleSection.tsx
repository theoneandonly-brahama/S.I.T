import { useId, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from './Icons.tsx';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  /** Initial state when the section is uncontrolled. */
  defaultOpen?: boolean;
  /** Controlled state; provide together with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * Card-styled disclosure used by the profile and settings pages. The
 * header is a real button with `aria-expanded`/`aria-controls`, so the
 * state is announced and keyboard-operable. Children are only mounted
 * while open; form state lives in the parent, so closing a section does
 * not discard a draft.
 */
export default function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className = '',
  id,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const contentId = useId();

  function toggle() {
    const next = !isOpen;
    if (onOpenChange) {
      onOpenChange(next);
    } else {
      setInternalOpen(next);
    }
  }

  return (
    <section id={id} className={`card overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={isOpen ? contentId : undefined}
        className="flex w-full items-start justify-between gap-4 p-6 text-left transition-colors hover:bg-ink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:p-8 dark:hover:bg-white/[0.04]"
      >
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-ink-900 dark:text-white">
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-sm text-ink-500 dark:text-ink-300">
              {description}
            </span>
          ) : null}
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-600 dark:bg-white/5 dark:text-ink-300">
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {isOpen ? (
        <div
          id={contentId}
          className="border-t border-ink-200/70 px-6 py-6 sm:px-8 dark:border-white/10"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
