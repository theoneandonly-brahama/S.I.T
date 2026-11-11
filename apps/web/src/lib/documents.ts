import type { ProfileDocument, UploadResponse } from '@sit/contract';

/** Metadata shared by an owned upload and a profile-attached document. */
export type DocumentMetadata = Pick<
  ProfileDocument,
  'id' | 'originalName' | 'storageKey' | 'mimeType' | 'size'
>;

export type ProfileDocumentSlot = 'photo' | 'cv' | 'diploma' | 'certification';

/**
 * Client-side mirror of the API's per-slot attachment rules. The API
 * re-checks every id, so these helpers only keep impossible menu
 * actions out of the interface.
 */
const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'];
const CV_MIME_TYPES = ['application/pdf'];
const CREDENTIAL_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const PHOTO_MAX_SIZE = 2 * 1024 * 1024;
const CV_MAX_SIZE = 5 * 1024 * 1024;
const CREDENTIAL_MAX_SIZE = 5 * 1024 * 1024;

export function canAttachAs(
  document: Pick<UploadResponse, 'mimeType' | 'size'>,
  slot: ProfileDocumentSlot
): boolean {
  if (slot === 'photo') {
    return (
      PHOTO_MIME_TYPES.includes(document.mimeType) &&
      document.size <= PHOTO_MAX_SIZE
    );
  }
  if (slot === 'cv') {
    return (
      CV_MIME_TYPES.includes(document.mimeType) && document.size <= CV_MAX_SIZE
    );
  }
  return (
    CREDENTIAL_MIME_TYPES.includes(document.mimeType) &&
    document.size <= CREDENTIAL_MAX_SIZE
  );
}

export function isPreviewable(
  document: Pick<UploadResponse, 'mimeType'>
): boolean {
  return (
    document.mimeType === 'application/pdf' ||
    document.mimeType.startsWith('image/')
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.ceil(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
