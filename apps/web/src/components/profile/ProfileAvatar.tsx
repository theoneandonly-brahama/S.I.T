import { useEffect, useState } from 'react';
import { useDocumentUrl } from '../../hooks/useDocumentUrl.ts';
import type { DocumentMetadata } from '../../lib/documents.ts';

interface ProfileAvatarProps {
  photo?: DocumentMetadata | null;
  initials: string;
  displayName: string;
  className?: string;
}

/**
 * Profile photo with an initials fallback. The surface behind the photo
 * is opaque in dark mode, so the cover banner cannot show through the
 * avatar while the image loads or when it fails.
 */
export default function ProfileAvatar({
  photo,
  initials,
  displayName,
  className = '',
}: ProfileAvatarProps) {
  const { url } = useDocumentUrl(photo);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [url]);

  const showImage = Boolean(url) && !imageError;

  return (
    <div
      className={`-translate-y-8 grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-brand-50 text-xl font-semibold text-brand-700 shadow-sm dark:border-ink-900 dark:bg-ink-900 dark:text-brand-200 ${className}`}
    >
      {showImage ? (
        <img
          src={url}
          alt={`${displayName} profile photo`}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        initials || 'S.I.T'
      )}
    </div>
  );
}
