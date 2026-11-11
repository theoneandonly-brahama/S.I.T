export type SocialPlatform =
  'facebook' | 'instagram' | 'x' | 'linkedin' | 'tiktok' | 'youtube' | 'github';

const PLATFORM_DOMAINS: Record<SocialPlatform, string[]> = {
  facebook: ['facebook.com', 'fb.com'],
  instagram: ['instagram.com'],
  x: ['x.com', 'twitter.com'],
  linkedin: ['linkedin.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  github: ['github.com'],
};

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  github: 'GitHub',
};

/**
 * Maps a profile link to a supported social platform. The hostname must
 * be the domain itself or a subdomain, so lookalikes such as
 * `facebook.com.example.org` are rejected. Only http(s) links qualify.
 */
export function socialPlatformForUrl(raw: string): SocialPlatform | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  for (const [platform, domains] of Object.entries(PLATFORM_DOMAINS) as Array<
    [SocialPlatform, string[]]
  >) {
    if (
      domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    ) {
      return platform;
    }
  }

  return null;
}
