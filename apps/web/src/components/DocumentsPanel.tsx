import {
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import type { UploadPurpose, UploadResponse } from '@sit/contract';
import {
  ApiError,
  deleteUpload,
  listUploads,
  uploadFile,
} from '../api/client.ts';
import { loadSession } from '../auth/session.ts';
import {
  canAttachAs,
  formatFileSize,
  isPreviewable,
  type ProfileDocumentSlot,
} from '../lib/documents.ts';
import Alert, { type AlertTone } from './ui/Alert.tsx';
import Button from './ui/Button.tsx';
import {
  ChevronDownIcon,
  EyeIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  UploadIcon,
} from './ui/Icons.tsx';

interface DocumentsPanelProps {
  uploads: UploadResponse[];
  onUploadsChange: (uploads: UploadResponse[]) => void;
  /** Called with the new upload so the profile can preview/select it. */
  onUploaded?: (upload: UploadResponse) => void;
  purpose: UploadPurpose;
  onPurposeChange: (purpose: UploadPurpose) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null until the student creates a profile. */
  profileId: string | null;
  attachments: {
    photoId: string;
    cvId: string;
    diplomaId: string;
    certificationIds: string[];
  };
  onSetProfileSlot: (
    upload: UploadResponse,
    slot: ProfileDocumentSlot,
    attach: boolean
  ) => Promise<void>;
  onPreview: (document: UploadResponse) => void;
}

interface MenuItemProps {
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  danger?: boolean;
}

function MenuItem({
  children,
  onClick,
  disabled = false,
  danger = false,
}: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? 'text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10'
          : 'text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Document management embedded in the profile page: POST /upload
 * (multipart, field name `file`) with an advisory purpose, GET /upload
 * for the owned list and DELETE /upload/:key. Each row exposes a
 * `…` menu with preview, define-as and delete actions.
 *
 * The parent owns the list, the upload purpose and the profile
 * attachment state, so the menu and the profile header stay in sync
 * after an upload, attachment change or deletion.
 */
export default function DocumentsPanel({
  uploads,
  onUploadsChange,
  onUploaded,
  purpose,
  onPurposeChange,
  open,
  onOpenChange,
  profileId,
  attachments,
  onSetProfileSlot,
  onPreview,
}: DocumentsPanelProps) {
  const [messages, setMessages] = useState<string[]>([]);
  const [tone, setTone] = useState<AlertTone>('error');
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const navigate = useNavigate();

  async function refresh(token: string) {
    onUploadsChange(await listUploads(token));
  }

  function closeMenu(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest('details')?.removeAttribute('open');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session || !file) {
      return;
    }
    setBusy(true);
    setMessages([]);
    try {
      const uploaded = await uploadFile(
        session.tokens.accessToken,
        file,
        purpose
      );
      setFile(null);
      await refresh(session.tokens.accessToken);
      onUploaded?.(uploaded);
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

  async function remove(
    event: MouseEvent<HTMLButtonElement>,
    storageKey: string
  ) {
    closeMenu(event);
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

  async function setSlot(
    event: MouseEvent<HTMLButtonElement>,
    upload: UploadResponse,
    slot: ProfileDocumentSlot,
    attach: boolean
  ) {
    closeMenu(event);
    if (!profileId) {
      setTone('error');
      setMessages(['Create your profile before attaching documents.']);
      return;
    }

    setActionBusy(true);
    setMessages([]);
    try {
      await onSetProfileSlot(upload, slot, attach);
      setTone('success');
      setMessages([
        attach
          ? 'Document attached to your profile.'
          : 'Document removed from your profile.',
      ]);
    } catch (error) {
      setTone('error');
      setMessages(
        error instanceof ApiError
          ? error.messages
          : [
              error instanceof Error
                ? error.message
                : 'Could not update profile.',
            ]
      );
    } finally {
      setActionBusy(false);
    }
  }

  function preview(
    event: MouseEvent<HTMLButtonElement>,
    upload: UploadResponse
  ) {
    closeMenu(event);
    onPreview(upload);
  }

  return (
    <section
      id="documents-panel"
      className="card mt-6"
      aria-labelledby="documents-heading"
    >
      <div className="flex items-start justify-between gap-4 p-6 sm:p-8">
        <div className="min-w-0">
          <h2
            id="documents-heading"
            className="text-lg font-semibold text-ink-900 dark:text-white"
          >
            Documents
          </h2>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
            Upload supporting files, then use the … menu to define them as your
            profile photo, CV, diploma or certification.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls={open ? 'documents-upload' : undefined}
          aria-label={open ? 'Close document upload' : 'Upload a document'}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-ink-200 dark:shadow-none dark:hover:bg-white/10"
        >
          {open ? 'Close' : 'Upload'}
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <div className="px-6 pb-6 sm:px-8 sm:pb-8">
        <Alert messages={messages} tone={tone} />

        {open ? (
          <form
            id="documents-upload"
            onSubmit={submit}
            className="mt-4 space-y-4"
            aria-busy={busy}
          >
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
                  onPurposeChange(event.target.value as UploadPurpose)
                }
              >
                <option value="GENERAL">
                  General document (image/PDF, up to 5 MB)
                </option>
                <option value="PROFILE_PHOTO">
                  Profile photo (JPEG/PNG, up to 2 MB)
                </option>
                <option value="PROFILE_CV">CV (PDF, up to 5 MB)</option>
              </select>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                {purpose === 'PROFILE_PHOTO'
                  ? 'JPEG or PNG up to 2 MB. After uploading, use the … menu to set it as your profile photo.'
                  : purpose === 'PROFILE_CV'
                    ? 'PDF up to 5 MB. After uploading, use the … menu to set it as your CV.'
                    : 'JPEG, PNG, GIF, WebP or PDF up to 5 MB. Use the … menu to define it.'}
              </p>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-white/15 dark:bg-white/5 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm dark:bg-white/10 dark:text-brand-300">
                <UploadIcon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">
                {file ? file.name : 'Choose an image or PDF'}
              </span>
              <span className="text-xs text-ink-500 dark:text-ink-300">
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
        ) : null}

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-white">
            Uploaded files
          </h3>

          {uploads.length === 0 ? (
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
              No documents yet. Use Upload to add your first file.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {uploads.map((upload) => {
                const chips = [
                  attachments.photoId === upload.id ? 'Profile photo' : null,
                  attachments.cvId === upload.id ? 'CV' : null,
                  attachments.diplomaId === upload.id ? 'Diploma' : null,
                  attachments.certificationIds.includes(upload.id)
                    ? 'Certification'
                    : null,
                ].filter((chip): chip is string => Boolean(chip));

                const isPhoto = attachments.photoId === upload.id;
                const isCv = attachments.cvId === upload.id;
                const isDiploma = attachments.diplomaId === upload.id;
                const isCertification = attachments.certificationIds.includes(
                  upload.id
                );

                return (
                  <li
                    key={upload.id}
                    className="flex flex-col gap-3 rounded-xl border border-ink-200/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
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
                          {upload.mimeType} · {upload.purpose} ·{' '}
                          {formatFileSize(upload.size)}
                        </p>
                        {chips.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {chips.map((chip) => (
                              <span
                                key={chip}
                                className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <details className="relative shrink-0">
                      <summary
                        aria-label={`Actions for ${upload.originalName}`}
                        className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-ink-300 bg-white text-ink-700 shadow-sm transition hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden dark:border-white/15 dark:bg-white/5 dark:text-ink-200 dark:shadow-none dark:hover:bg-white/10"
                      >
                        <MoreHorizontalIcon className="h-4 w-4" />
                      </summary>
                      <div
                        role="group"
                        aria-label="Document actions"
                        className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-ink-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-ink-900"
                      >
                        <MenuItem
                          onClick={(event) => preview(event, upload)}
                          disabled={!isPreviewable(upload) || actionBusy}
                        >
                          <EyeIcon className="h-4 w-4" />
                          Preview
                        </MenuItem>

                        {profileId ? (
                          <>
                            <div
                              className="my-1 h-px bg-ink-200 dark:bg-white/10"
                              aria-hidden="true"
                            />
                            <p className="px-3 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                              Define as…
                            </p>
                            <MenuItem
                              onClick={(event) =>
                                setSlot(event, upload, 'photo', !isPhoto)
                              }
                              disabled={
                                actionBusy ||
                                (!isPhoto && !canAttachAs(upload, 'photo'))
                              }
                            >
                              {isPhoto
                                ? 'Remove profile photo'
                                : 'Set as profile photo'}
                            </MenuItem>
                            <MenuItem
                              onClick={(event) =>
                                setSlot(event, upload, 'cv', !isCv)
                              }
                              disabled={
                                actionBusy ||
                                (!isCv && !canAttachAs(upload, 'cv'))
                              }
                            >
                              {isCv ? 'Remove CV' : 'Set as CV'}
                            </MenuItem>
                            <MenuItem
                              onClick={(event) =>
                                setSlot(event, upload, 'diploma', !isDiploma)
                              }
                              disabled={
                                actionBusy ||
                                (!isDiploma && !canAttachAs(upload, 'diploma'))
                              }
                            >
                              {isDiploma ? 'Remove diploma' : 'Set as diploma'}
                            </MenuItem>
                            <MenuItem
                              onClick={(event) =>
                                setSlot(
                                  event,
                                  upload,
                                  'certification',
                                  !isCertification
                                )
                              }
                              disabled={
                                actionBusy ||
                                (!isCertification &&
                                  !canAttachAs(upload, 'certification'))
                              }
                            >
                              {isCertification
                                ? 'Remove certification'
                                : 'Add as certification'}
                            </MenuItem>
                          </>
                        ) : (
                          <p className="px-3 py-2 text-xs text-ink-500 dark:text-ink-400">
                            Create your profile before attaching documents.
                          </p>
                        )}

                        <div
                          className="my-1 h-px bg-ink-200 dark:bg-white/10"
                          aria-hidden="true"
                        />
                        <MenuItem
                          danger
                          onClick={(event) => remove(event, upload.storageKey)}
                          disabled={actionBusy}
                        >
                          Delete
                        </MenuItem>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
