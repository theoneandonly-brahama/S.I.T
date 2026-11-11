import { formatFileSize, type DocumentMetadata } from '../../lib/documents.ts';
import Button from '../ui/Button.tsx';
import { EyeIcon, FileTextIcon } from '../ui/Icons.tsx';

interface ProfileDocumentsProps {
  uploads: DocumentMetadata[];
  cvId: string;
  diplomaId: string;
  certificationIds: string[];
  onPreview: (document: DocumentMetadata) => void;
  className?: string;
}

interface DocumentCardProps {
  label: string;
  document: DocumentMetadata;
  onPreview: (document: DocumentMetadata) => void;
}

function DocumentCard({ label, document, onPreview }: DocumentCardProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-ink-200/70 p-4 dark:border-white/10">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <FileTextIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            {label}
          </p>
          <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
            {document.originalName}
          </p>
          <p className="text-xs text-ink-500 dark:text-ink-300">
            {formatFileSize(document.size)}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onPreview(document)}
        aria-label={`Preview ${document.originalName}`}
      >
        <EyeIcon className="h-4 w-4" />
        Preview
      </Button>
    </div>
  );
}

/**
 * Read-only summary of the documents attached to the profile. The
 * management surface (attach, detach, delete) lives in the Documents
 * panel below; this section makes the attached CV, diploma and
 * certifications immediately visible and previewable.
 */
export default function ProfileDocuments({
  uploads,
  cvId,
  diplomaId,
  certificationIds,
  onPreview,
  className = '',
}: ProfileDocumentsProps) {
  const byId = new Map(uploads.map((upload) => [upload.id, upload]));
  const cv = cvId ? byId.get(cvId) : undefined;
  const diploma = diplomaId ? byId.get(diplomaId) : undefined;
  const certifications = certificationIds
    .map((id) => byId.get(id))
    .filter((upload): upload is DocumentMetadata => Boolean(upload));

  const hasDocuments = Boolean(cv || diploma || certifications.length > 0);

  return (
    <section
      className={`card mt-6 p-6 sm:p-8 ${className}`}
      aria-labelledby="profile-documents-heading"
    >
      <div>
        <h2
          id="profile-documents-heading"
          className="text-lg font-semibold text-ink-900 dark:text-white"
        >
          Profile documents
        </h2>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
          Your attached CV, diploma and certifications. Use the … menu in
          Documents below to change them.
        </p>
      </div>

      {hasDocuments ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {cv ? (
            <DocumentCard label="CV" document={cv} onPreview={onPreview} />
          ) : null}
          {diploma ? (
            <DocumentCard
              label="Diploma"
              document={diploma}
              onPreview={onPreview}
            />
          ) : null}
          {certifications.map((document, index) => (
            <DocumentCard
              key={document.id}
              label={
                certifications.length > 1
                  ? `Certification ${index + 1}`
                  : 'Certification'
              }
              document={document}
              onPreview={onPreview}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-500 dark:text-ink-300">
          No CV, diploma or certifications attached yet. Upload a file below and
          use the … menu to define it.
        </p>
      )}
    </section>
  );
}
