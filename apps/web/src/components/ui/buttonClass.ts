export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'inverse';
export type ButtonSize = 'md' | 'sm';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  inverse: 'btn-inverse',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'btn-md',
  sm: 'btn-sm',
};

/** Compose the shared button classes for both <button> and <Link>. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = ''
): string {
  return ['btn', VARIANTS[variant], SIZES[size], extra]
    .filter(Boolean)
    .join(' ');
}
