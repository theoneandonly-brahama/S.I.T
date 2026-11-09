/**
 * Per-slot upload limits for E1-US2.
 *
 * The general upload pipeline keeps its own configurable 5 MB cap. Profile
 * slots are narrower: a profile photo is a JPEG/PNG up to 2 MB, and a CV is
 * a PDF up to 5 MB. These constants are shared by the upload pipeline and
 * the profile attachment validation so the two cannot drift.
 */
export const PROFILE_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const PROFILE_CV_MIME_TYPES = ['application/pdf'] as const;
export const PROFILE_PHOTO_MAX_SIZE = 2 * 1024 * 1024;
export const PROFILE_CV_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Checks that the first bytes of a file buffer match the magic-byte
 * signature of its declared MIME type (E1-US2.b content validation).
 *
 * The declared multipart Content-Type is client-supplied and cannot be
 * trusted alone: without this check, any bytes can be stored by
 * declaring an allowed type. Magic bytes are the file-format
 * fingerprints every real encoder writes; they are not secret — this
 * is format verification, not malware detection (deferred per the
 * report's controls/limits section).
 *
 * Only the allowlisted types are supported; anything else returns
 * false (the MIME allowlist check runs first and rejects those).
 */
export function matchesMimeMagic(buffer: Buffer, mimeType: string): boolean {
  const startsWith = (bytes: number[]): boolean =>
    buffer.length >= bytes.length &&
    bytes.every((byte, index) => buffer[index] === byte);

  switch (mimeType) {
    case 'image/jpeg':
      // SOI marker + first marker byte: FF D8 FF
      return startsWith([0xff, 0xd8, 0xff]);
    case 'image/png':
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/gif':
      // 'GIF8' (GIF87a / GIF89a)
      return startsWith([0x47, 0x49, 0x46, 0x38]);
    case 'image/webp':
      // RIFF chunk (52 49 46 46) with 'WEBP' (57 45 42 50) at offset 8.
      // No explicit length check: on a short buffer buffer[8..11] is
      // undefined, which never equals the expected bytes, so the check
      // already fails safely.
      return (
        startsWith([0x52, 0x49, 0x46, 0x46]) &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    case 'application/pdf':
      // '%PDF'
      return startsWith([0x25, 0x50, 0x44, 0x46]);
    default:
      return false;
  }
}
