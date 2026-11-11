import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SocialLinks from './SocialLinks.tsx';

describe('SocialLinks', () => {
  it('renders nothing when no links are provided', () => {
    const { container } = render(<SocialLinks links={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('ignores links that do not belong to a supported platform', () => {
    const { container } = render(
      <SocialLinks
        links={[
          'https://example.com/in/student',
          'not a url',
          'ftp://x.com/student',
        ]}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('rejects lookalike hostnames such as facebook.com.example.org', () => {
    const { container } = render(
      <SocialLinks links={['https://facebook.com.example.org/ada']} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders a safe link for each recognised platform', () => {
    render(
      <SocialLinks
        links={[
          'https://facebook.com/ada',
          'https://www.instagram.com/ada',
          'https://twitter.com/ada',
          'https://x.com/adalovelace',
          'https://www.linkedin.com/in/ada',
          'https://youtu.be/ada',
          'https://github.com/ada',
        ]}
      />
    );

    for (const label of [
      'Facebook',
      'Instagram',
      'X',
      'LinkedIn',
      'YouTube',
      'GitHub',
    ]) {
      expect(
        screen.getByRole('link', { name: `${label} profile` })
      ).toBeTruthy();
    }

    const youtube = screen.getByRole('link', { name: /youtube profile/i });
    expect(youtube.getAttribute('href')).toBe('https://youtu.be/ada');
    expect(youtube.getAttribute('rel')).toBe('noopener noreferrer');
    expect(youtube.getAttribute('target')).toBe('_blank');
  });

  it('dedupes twitter.com and x.com into a single X icon', () => {
    render(
      <SocialLinks
        links={['https://twitter.com/ada', 'https://x.com/adalovelace']}
      />
    );

    expect(screen.getAllByRole('link', { name: /^x profile$/i })).toHaveLength(
      1
    );
  });
});
