import type { ComponentType, SVGProps } from 'react';
import {
  FacebookIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from '../ui/Icons.tsx';
import {
  SOCIAL_PLATFORM_LABELS,
  socialPlatformForUrl,
  type SocialPlatform,
} from '../../lib/social.ts';

const PLATFORM_ICONS: Record<
  SocialPlatform,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  x: XIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  github: GitHubIcon,
};

interface SocialLinksProps {
  links: string[];
}

/**
 * Renders one compact link per recognised social profile. Links that
 * are not http(s) URLs or do not belong to a supported platform are
 * omitted, so the header only advertises profiles the student actually
 * added. External links open in a new tab with `noopener noreferrer`.
 */
export default function SocialLinks({ links }: SocialLinksProps) {
  const items: Array<{ url: string; platform: SocialPlatform }> = [];
  const seen = new Set<SocialPlatform>();

  for (const raw of links) {
    const platform = socialPlatformForUrl(raw);
    // One icon per platform: twitter.com and x.com both map to X, and
    // duplicate profile entries should not render duplicate icons.
    if (platform && !seen.has(platform)) {
      seen.add(platform);
      items.push({ url: raw.trim(), platform });
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <ul
      className="flex flex-wrap items-center gap-2"
      aria-label="Social profiles"
    >
      {items.map(({ url, platform }, index) => {
        const Icon = PLATFORM_ICONS[platform];
        const label = SOCIAL_PLATFORM_LABELS[platform];

        return (
          <li key={`${platform}-${url}-${index}`}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${label} profile`}
              title={label}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-600 shadow-sm transition hover:border-brand-300 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:shadow-none dark:hover:border-brand-400/50 dark:hover:text-brand-200"
            >
              <Icon className="h-4 w-4" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
