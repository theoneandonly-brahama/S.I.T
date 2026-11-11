import type { ButtonHTMLAttributes } from 'react';
import {
  buttonClass,
  type ButtonSize,
  type ButtonVariant,
} from './buttonClass.ts';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

/** Shared button primitive; variant/size map onto the design tokens. */
export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClass(
        variant,
        size,
        `${block ? 'w-full' : ''} ${className}`
      )}
      {...props}
    />
  );
}
