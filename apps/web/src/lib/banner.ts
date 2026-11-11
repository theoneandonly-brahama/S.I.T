/**
 * Cover-banner helpers.
 *
 * The API is authoritative for the colour policy; this mirror exists so
 * the profile editor can reject an unpleasant choice before a round trip.
 * Keep the two implementations aligned when the policy changes.
 */
export const DEFAULT_BANNER_COLOR = '#c8102e';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isAllowedBannerColor(value: string): boolean {
  if (!HEX_COLOR.test(value)) {
    return false;
  }

  const red = parseInt(value.slice(1, 3), 16) / 255;
  const green = parseInt(value.slice(3, 5), 16) / 255;
  const blue = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const saturation =
    max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));

  return (
    saturation >= 0.3 &&
    saturation <= 0.9 &&
    lightness >= 0.25 &&
    lightness <= 0.55
  );
}

/**
 * A restrained left-to-right gradient derived from one colour. The
 * darker and lighter ends keep the strip from looking flat without
 * introducing a second hue.
 */
export function bannerGradient(color: string): string {
  return [
    'linear-gradient(90deg,',
    `color-mix(in srgb, ${color} 82%, black),`,
    `${color} 52%,`,
    `color-mix(in srgb, ${color} 88%, white))`,
  ].join(' ');
}
