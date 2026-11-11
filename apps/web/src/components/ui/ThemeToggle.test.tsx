import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'light';
    window.localStorage.clear();
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it('switches the document theme and persists the choice', () => {
    render(<ThemeToggle />);

    fireEvent.click(
      screen.getByRole('button', { name: /switch to dark mode/i })
    );

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('sit-theme')).toBe('dark');
    expect(
      screen.getByRole('button', { name: /switch to light mode/i })
    ).toBeTruthy();
  });
});
