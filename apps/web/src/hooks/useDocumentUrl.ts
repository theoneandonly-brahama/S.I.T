import { useEffect, useState } from 'react';
import { ApiError, downloadUpload } from '../api/client.ts';
import { loadSession } from '../auth/session.ts';
import type { DocumentMetadata } from '../lib/documents.ts';

export interface DocumentUrlState {
  url?: string;
  loading: boolean;
  error?: string;
}

/**
 * Fetches a protected upload with the access token and exposes a local
 * object URL. The URL is revoked when the file changes or the component
 * unmounts, so previews do not leak blob handles.
 */
export function useDocumentUrl(
  file?: DocumentMetadata | null
): DocumentUrlState {
  const storageKey = file?.storageKey;
  const [state, setState] = useState<DocumentUrlState>({
    loading: Boolean(storageKey),
  });

  useEffect(() => {
    if (!storageKey) {
      setState({ loading: false });
      return;
    }

    const session = loadSession();
    if (!session) {
      setState({
        loading: false,
        error: 'Sign in to view this document.',
      });
      return;
    }

    if (typeof URL.createObjectURL !== 'function') {
      setState({
        loading: false,
        error: 'This browser cannot preview documents.',
      });
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;
    setState({ loading: true });

    downloadUpload(session.tokens.accessToken, storageKey)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setState({ loading: false, url: objectUrl });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setState({
          loading: false,
          error:
            error instanceof ApiError
              ? error.messages.join(' ')
              : 'Preview unavailable.',
        });
      });

    return () => {
      cancelled = true;
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [storageKey]);

  return state;
}
