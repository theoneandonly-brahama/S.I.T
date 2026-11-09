import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders the hero heading and links to registration', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', {
      level: 1,
      name: /your path to studying in tunisia/i,
    });
    expect(heading.textContent).toMatch(/studying in tunisia/i);

    const registerLinks = screen.getAllByRole('link', {
      name: /create your account/i,
    });
    expect(registerLinks.length).toBeGreaterThan(0);
    expect(registerLinks[0].getAttribute('href')).toBe('/register');

    const loginLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0].getAttribute('href')).toBe('/login');
  });
});
