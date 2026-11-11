import { useEffect, useRef, useState } from 'react';
import { useDocumentUrl } from '../../hooks/useDocumentUrl.ts';
import type { DocumentMetadata } from '../../lib/documents.ts';
import { CloseIcon } from '../ui/Icons.tsx';

interface DocumentPreviewDialogProps {
  document: DocumentMetadata;
  onClose: () => void;
}

/**
 * In-page preview for an attached or uploaded document. The API's
 * download route is JWT-guarded, so the file is fetched as a Blob and
 * displayed through an object URL; PDFs use the browser's built-in
 * viewer. A plain link remains available as a fallback.
 */
export default function DocumentPreviewDialog({
  document,
  onClose,
}: DocumentPreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { url, loading, error } = useDocumentUrl(document);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    // No cleanup close(): unmounting removes the dialog from the DOM,
    // and a programmatic close() would emit `close`, which the onClose
    // handler would interpret as a user dismissal.
  }, []);

  useEffect(() => {
    setMediaError(false);
  }, [url]);

  const isImage = document.mimeType.startsWith('image/');
  const isPdf = document.mimeType === 'application/pdf';

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      aria-labelledby="document-preview-title"
      className="m-auto max-h-[90vh] w-[min(92vw,56rem)] overflow-hidden rounded-2xl border border-ink-200 bg-white p-0 shadow-2xl backdrop:bg-ink-950/60 dark:border-white/10 dark:bg-ink-900"
    >
      <div className="flex items-center justify-between gap-4 border-b border-ink-200 px-4 py-3 dark:border-white/10">
        <div className="min-w-0">
          <h2
            id="document-preview-title"
            className="truncate text-base font-semibold text-ink-900 dark:text-white"
          >
            {document.originalName}
          </h2>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {document.mimeType}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-600 transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-ink-200 dark:hover:bg-white/10"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[calc(90vh-4.5rem)] overflow-auto p-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-ink-500 dark:text-ink-300">
            Loading preview…
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
          >
            {error}
          </p>
        ) : url && isImage && !mediaError ? (
          <img
            src={url}
            alt={document.originalName}
            className="mx-auto max-h-[70vh] w-auto rounded-xl"
            onError={() => setMediaError(true)}
          />
        ) : url && isPdf ? (
          <iframe
            src={url}
            title={`Preview of ${document.originalName}`}
            className="h-[70vh] w-full rounded-xl border border-ink-200 dark:border-white/10"
          />
        ) : url ? (
          <p className="py-10 text-center text-sm text-ink-500 dark:text-ink-300">
            This file type cannot be previewed in the browser.
          </p>
        ) : null}

        {url ? (
          <div className="mt-3 flex justify-end">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-300"
            >
              Open in new tab
            </a>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
