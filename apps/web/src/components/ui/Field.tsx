import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Helper text shown below the field when there is no error. */
  hint?: string;
  /** Validation message; also marks the input as invalid. */
  error?: string;
}

/**
 * Labelled input with accessible error wiring. The visual radius comes
 * from `.form-input` (0.75rem), so every form in the app stays
 * consistent.
 */
export default function Field({
  label,
  hint,
  error,
  id,
  name,
  className = '',
  ...props
}: FieldProps) {
  const inputId = id ?? name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label className="form-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`form-input ${
          error
            ? 'border-brand-500 focus:border-brand-500 focus:ring-brand-500/20'
            : ''
        } ${className}`}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="mt-1 text-xs text-brand-600 dark:text-brand-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}
