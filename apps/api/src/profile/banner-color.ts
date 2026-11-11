/**
 * Banner colour policy.
 *
 * A free colour picker is useful, but some choices make the cover strip
 * unreadable or visually inconsistent with the rest of the interface.
 * The policy keeps the hue free while requiring a reasonably saturated,
 * mid-tone colour: very pale pastels, near-black shades and neutral
 * greys are rejected. The web client applies the same rule for immediate
 * feedback; this API check is the authoritative one.
 */
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
