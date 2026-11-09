import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { UploadPurpose, UploadResponse } from '@sit/contract';
import {
  ApiError,
  deleteUpload,
  listUploads,
  uploadFile,
} from '../api/client.ts';
import { loadSession } from '../auth/session.ts';
import PageIllustration from '../components/PageIllustration.tsx';
import Alert, { type AlertTone } from '../components/ui/Alert.tsx';
import Button from '../components/ui/Button.tsx';
import { FileTextIcon, UploadIcon } from '../components/ui/Icons.tsx';

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.ceil(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upload management over the verified API surface: POST /upload
 * (multipart, field name `file`) with a slot purpose, GET /upload for
 * the owned list and DELETE /upload/:key. Signature URLs live behind
 * signed-access and are not part of this prototype page.
 */
export default function UploadPage() {
  const [uploads, setUploads] = useState<UploadResponse[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [tone, setTone] = useState<AlertTone>('error');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState<UploadPurpose>('GENERAL');
  const navigate = useNavigate();

  function refresh(token: string) {
    return listUploads(token)
      .then(setUploads)
      .catch((error: unknown) => {
        setTone('error');
        setMessages(
          error instanceof ApiError ? error.messages : ['Network error.']
        );
      });
  }

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }
    refresh(session.tokens.accessToken);
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session || !file) {
      return;
    }
    setBusy(true);
    setMessages([]);
    try {
      await uploadFile(session.tokens.accessToken, file, purpose);
      setFile(null);
      await refresh(session.tokens.accessToken);
      setTone('success');
      setMessages(['Document uploaded.']);
    } catch (error) {
      setTone('error');
      setMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(storageKey: string) {
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }
    setMessages([]);
    try {
      await deleteUpload(session.tokens.accessToken, storageKey);
      await refresh(session.tokens.accessToken);
      setTone('success');
      setMessages(['Document deleted.']);
    } catch (error) {
      setTone('error');
      setMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    }
  }

  return (
    <div className="relative overflow-hidden">
      <PageIllustration />

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
            Your documents
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900 dark:text-white">
            Keep everything together
          </h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
            Upload the supporting files your applications need, and reuse them
            whenever a programme asks for them.
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
            <Alert messages={messages} tone={tone} />

            <div>
              <label className="form-label" htmlFor="purpose">
                Upload as
              </label>
              <select
                id="purpose"
                name="purpose"
                className="form-input"
                value={purpose}
                onChange={(event) =>
                  setPurpose(event.target.value as UploadPurpose)
                }
              >
                <option value="GENERAL">General document (image/PDF, up to 5 MB)</option>
                <option value="PROFILE_PHOTO">Profile photo (JPEG/PNG, up to 2 MB)</option>
                <option value="PROFILE_CV">CV (PDF, up to 5 MB)</option>
              </select>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                {purpose === 'PROFILE_PHOTO'
                  ? 'JPEG or PNG up to 2 MB. After uploading, attach it to your profile from the Profile page.'
                  : purpose === 'PROFILE_CV'
                    ? 'PDF up to 5 MB. After uploading, attach it to your profile from the Profile page.'
                    : 'JPEG, PNG, GIF, WebP or PDF up to 5 MB.'}
              </p>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-white/15 dark:bg-white/5 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm dark:bg-white/10 dark:text-brand-300">
                <UploadIcon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">
                {file ? file.name : 'Choose an image or PDF'}
              </span>
              <span className="text-xs text-ink-500 dark:text-ink-400">
                JPEG, PNG, GIF, WebP or PDF
              </span>
              <input
                type="file"
                className="sr-only"
                accept={
                  purpose === 'PROFILE_PHOTO'
                    ? 'image/jpeg,image/png'
                    : purpose === 'PROFILE_CV'
                      ? 'application/pdf'
                      : 'image/jpeg,image/png,image/gif,image/webp,application/pdf'
                }
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <div className="flex justify-end">
              <Button type="submit" disabled={!file || busy}>
                {busy ? 'Uploading…' : 'Upload document'}
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">
            Uploaded files
          </h2>

          {uploads.length === 0 ? (
            <div className="card mt-3 p-6 text-sm text-ink-500 dark:text-ink-300">
              No documents yet. Upload your first file above.
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {uploads.map((upload) => (
                <li
                  key={upload.id}
                  className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                      <FileTextIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                        {upload.originalName}
                      </p>
                      <p className="text-xs text-ink-500 dark:text-ink-300">
                        {upload.mimeType} · {upload.purpose} · {formatSize(upload.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => remove(upload.storageKey)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
