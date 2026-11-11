import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import type {
  CreateProfileRequest,
  CurriculumEntry,
  ProfileResponse,
  UpdateProfileRequest,
  UploadPurpose,
  UploadResponse,
} from '@sit/contract';
import {
  ApiError,
  createProfile,
  getProfile,
  listUploads,
  updateProfile,
} from '../api/client.ts';
import { loadSession } from '../auth/session.ts';
import PageIllustration from '../components/PageIllustration.tsx';
import DocumentsPanel from '../components/DocumentsPanel.tsx';
import DocumentPreviewDialog from '../components/profile/DocumentPreviewDialog.tsx';
import ProfileAvatar from '../components/profile/ProfileAvatar.tsx';
import ProfileDocuments from '../components/profile/ProfileDocuments.tsx';
import SocialLinks from '../components/profile/SocialLinks.tsx';
import Alert, { type AlertTone } from '../components/ui/Alert.tsx';
import Button from '../components/ui/Button.tsx';
import CollapsibleSection from '../components/ui/CollapsibleSection.tsx';
import Field from '../components/ui/Field.tsx';
import {
  bannerGradient,
  DEFAULT_BANNER_COLOR,
  isAllowedBannerColor,
} from '../lib/banner.ts';
import type {
  DocumentMetadata,
  ProfileDocumentSlot,
} from '../lib/documents.ts';

interface CurriculumDraft {
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
}

const EMPTY_CURRICULUM_ROW: CurriculumDraft = {
  institution: '',
  degree: '',
  field: '',
  startYear: '',
  endYear: '',
};

const EMPTY_FORM: CreateProfileRequest = {
  firstName: '',
  lastName: '',
  diploma: '',
  university: '',
  skills: [],
  links: [],
  curriculum: [],
};

/** 'a, b ,c' -> ['a', 'b', 'c'] (trimmed, non-empty, de-duplicated). */
function parseList(input: string): string[] {
  return [
    ...new Set(
      input
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    ),
  ];
}

function toDraft(entry: CurriculumEntry): CurriculumDraft {
  return {
    institution: entry.institution,
    degree: entry.degree,
    field: entry.field ?? '',
    startYear: entry.startYear !== undefined ? String(entry.startYear) : '',
    endYear: entry.endYear !== undefined ? String(entry.endYear) : '',
  };
}

function toEntry(draft: CurriculumDraft): CurriculumEntry {
  const entry: CurriculumEntry = {
    institution: draft.institution.trim(),
    degree: draft.degree.trim(),
  };
  if (draft.field.trim()) {
    entry.field = draft.field.trim();
  }
  if (draft.startYear.trim()) {
    entry.startYear = Number(draft.startYear);
  }
  if (draft.endYear.trim()) {
    entry.endYear = Number(draft.endYear);
  }
  return entry;
}

/**
 * One labelled group inside the profile editor: a small caps heading and
 * a hairline divider, so the form reads as sections rather than one long
 * column of inputs. `divider: false` is used for the first group.
 */
function FormSection({
  title,
  divider = true,
  children,
}: {
  title: string;
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`space-y-4 ${
        divider ? 'border-t border-ink-200 pt-5 dark:border-white/10' : ''
      }`}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Profile editor with create/patch semantics: if the account has no
 * profile yet the first submission POSTs, afterwards submissions PATCH
 * (unchanged fields are sent too — the API preserves them).
 *
 * Documents are managed from the Documents panel's per-file `…` menu.
 * The attached CV, diploma and certifications are surfaced above the
 * editor and previewed in an in-page dialog. Unauthenticated visits are
 * redirected to /login.
 */
export default function ProfilePage() {
  const [form, setForm] = useState<CreateProfileRequest>(EMPTY_FORM);
  const [skillsInput, setSkillsInput] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumDraft[]>([]);
  const [uploads, setUploads] = useState<UploadResponse[]>([]);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [photoUploadId, setPhotoUploadId] = useState<string>('');
  const [cvUploadId, setCvUploadId] = useState<string>('');
  const [diplomaUploadId, setDiplomaUploadId] = useState<string>('');
  const [certificationUploadIds, setCertificationUploadIds] = useState<
    string[]
  >([]);
  const [bannerColor, setBannerColor] = useState(DEFAULT_BANNER_COLOR);
  const [bannerCustom, setBannerCustom] = useState(false);
  const [previewDocument, setPreviewDocument] =
    useState<DocumentMetadata | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [tone, setTone] = useState<AlertTone>('error');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState<UploadPurpose>('GENERAL');
  const [accountEmail, setAccountEmail] = useState('');
  const navigate = useNavigate();

  const applyProfile = useCallback((saved: ProfileResponse) => {
    setProfile(saved);
    setProfileId(saved.id);
    setPhotoUploadId(saved.photo?.id ?? '');
    setCvUploadId(saved.cv?.id ?? '');
    setDiplomaUploadId(saved.diplomaDocument?.id ?? '');
    setCertificationUploadIds(
      (saved.certifications ?? []).map((document) => document.id)
    );

    const savedColor = saved.bannerColor;
    const custom = Boolean(savedColor && isAllowedBannerColor(savedColor));
    setBannerCustom(custom);
    setBannerColor(custom && savedColor ? savedColor : DEFAULT_BANNER_COLOR);
  }, []);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }
    setAccountEmail(session.account.email);

    getProfile(session.tokens.accessToken)
      .then((loaded) => {
        applyProfile(loaded);
        setForm({
          firstName: loaded.firstName,
          lastName: loaded.lastName,
          diploma: loaded.diploma ?? '',
          university: loaded.university ?? '',
          skills: loaded.skills ?? [],
          links: loaded.links ?? [],
          curriculum: loaded.curriculum ?? [],
        });
        setSkillsInput((loaded.skills ?? []).join(', '));
        setLinks(loaded.links ?? []);
        setCurriculum((loaded.curriculum ?? []).map(toDraft));
        // An existing profile starts collapsed; the header card is the
        // read-only summary.
        setProfileOpen(false);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          // Expected for a fresh account: start with an empty editor.
          setProfile(null);
          setProfileId(null);
          setPhotoUploadId('');
          setCvUploadId('');
          setDiplomaUploadId('');
          setCertificationUploadIds([]);
          setBannerColor(DEFAULT_BANNER_COLOR);
          setBannerCustom(false);
          setProfileOpen(true);
        } else {
          setTone('error');
          setMessages(
            error instanceof ApiError ? error.messages : ['Network error.']
          );
        }
      })
      .finally(() => setLoading(false));

    listUploads(session.tokens.accessToken)
      .then(setUploads)
      .catch(() => {
        // Uploads are optional for the profile form; a failure here
        // must not block editing the textual fields.
        setUploads([]);
      });
  }, [applyProfile, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }

    if (bannerCustom && !isAllowedBannerColor(bannerColor)) {
      setTone('error');
      setMessages([
        'Choose a mid-tone, reasonably saturated cover colour before saving.',
      ]);
      return;
    }

    const { accessToken } = session.tokens;
    const payload: CreateProfileRequest = {
      ...form,
      skills: parseList(skillsInput),
      links: [...new Set(links.map((link) => link.trim()).filter(Boolean))],
      curriculum: curriculum.map(toEntry),
      // Empty selection detaches the slot (null); the API re-checks
      // ownership, MIME and size for attached uploads.
      photoUploadId: photoUploadId || null,
      cvUploadId: cvUploadId || null,
      diplomaUploadId: diplomaUploadId || null,
      certificationUploadIds,
      bannerColor: bannerCustom ? bannerColor : null,
    };
    setBusy(true);
    setMessages([]);
    try {
      const saved = profileId
        ? await updateProfile(accessToken, payload)
        : await createProfile(accessToken, payload);
      applyProfile(saved);
      setTone('success');
      setMessages(['Profile saved.']);
    } catch (error) {
      setTone('error');
      setMessages(
        error instanceof ApiError ? error.messages : ['Network error.']
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Keep the attachment state valid when a document is deleted from the
   * embedded documents panel: a stale id would make the next profile
   * save fail the API's ownership check.
   */
  function handleUploadsChange(next: UploadResponse[]) {
    setUploads(next);
    const ids = new Set(next.map((upload) => upload.id));
    setPhotoUploadId((current) =>
      current && !ids.has(current) ? '' : current
    );
    setCvUploadId((current) => (current && !ids.has(current) ? '' : current));
    setDiplomaUploadId((current) =>
      current && !ids.has(current) ? '' : current
    );
    setCertificationUploadIds((current) => current.filter((id) => ids.has(id)));
    setProfile((current) =>
      current
        ? {
            ...current,
            photo:
              current.photo && ids.has(current.photo.id)
                ? current.photo
                : undefined,
            cv: current.cv && ids.has(current.cv.id) ? current.cv : undefined,
            diplomaDocument:
              current.diplomaDocument && ids.has(current.diplomaDocument.id)
                ? current.diplomaDocument
                : undefined,
            certifications: (current.certifications ?? []).filter((document) =>
              ids.has(document.id)
            ),
          }
        : current
    );
  }

  /** Preview a slot upload immediately after a successful upload. */
  function handleUploaded(upload: UploadResponse) {
    if (upload.purpose === 'PROFILE_PHOTO') {
      setPhotoUploadId(upload.id);
    }
    if (upload.purpose === 'PROFILE_CV') {
      setCvUploadId(upload.id);
    }
  }

  /**
   * Persist one `Define as…` action. The upload purpose is not changed;
   * the profile slot is attached or detached independently.
   */
  async function setProfileSlot(
    upload: UploadResponse,
    slot: ProfileDocumentSlot,
    attach: boolean
  ) {
    const session = loadSession();
    if (!session) {
      navigate('/login');
      throw new Error('Sign in to update your profile.');
    }
    if (!profileId) {
      throw new Error('Create your profile before attaching documents.');
    }

    const dto: UpdateProfileRequest = {};
    if (slot === 'photo') {
      dto.photoUploadId = attach ? upload.id : null;
    } else if (slot === 'cv') {
      dto.cvUploadId = attach ? upload.id : null;
    } else if (slot === 'diploma') {
      dto.diplomaUploadId = attach ? upload.id : null;
    } else {
      const without = certificationUploadIds.filter((id) => id !== upload.id);
      dto.certificationUploadIds = attach ? [...without, upload.id] : without;
    }

    const updated = await updateProfile(session.tokens.accessToken, dto);
    applyProfile(updated);
  }

  function openProfileEditor() {
    setProfileOpen(true);
    document
      .getElementById('profile-information')
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function addLink() {
    setLinks((current) => (current.length >= 10 ? current : [...current, '']));
  }

  function updateLink(index: number, value: string) {
    setLinks((current) =>
      current.map((link, i) => (i === index ? value : link))
    );
  }

  function removeLink(index: number) {
    setLinks((current) => current.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <div className="relative overflow-hidden">
        <PageIllustration />
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 md:py-20">
          <div className="card p-6 sm:p-8">
            <p className="text-sm text-ink-500 dark:text-ink-300">
              Loading your profile…
            </p>
          </div>
        </section>
      </div>
    );
  }

  const update = (field: keyof CreateProfileRequest) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const updateCurriculumRow =
    (index: number, field: keyof CurriculumDraft) => (value: string) =>
      setCurriculum((rows) =>
        rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      );

  const initials = `${form.firstName.trim().charAt(0)}${form.lastName
    .trim()
    .charAt(0)}`.toUpperCase();
  const displayName =
    [form.firstName, form.lastName].filter(Boolean).join(' ').trim() ||
    'Your profile';
  const headline =
    [form.diploma, form.university].filter(Boolean).join(' · ') ||
    'Add your diploma and university to stand out.';
  const profileSummary =
    [form.diploma, form.university].filter(Boolean).join(' · ') ||
    'Add your studies, skills and links.';

  const stats = [
    { label: 'Skills', value: parseList(skillsInput).length },
    { label: 'Links', value: links.filter((link) => link.trim()).length },
    { label: 'Documents', value: uploads.length },
  ];

  const selectedPhoto =
    uploads.find((upload) => upload.id === photoUploadId) ??
    (profile?.photo && profile.photo.id === photoUploadId
      ? profile.photo
      : undefined);

  const documentPool: DocumentMetadata[] = [...uploads];
  function addProfileDocument(document?: DocumentMetadata | null) {
    if (document && !documentPool.some((item) => item.id === document.id)) {
      documentPool.push(document);
    }
  }
  if (profile) {
    addProfileDocument(profile.photo);
    addProfileDocument(profile.cv);
    addProfileDocument(profile.diplomaDocument);
    for (const document of profile.certifications ?? []) {
      addProfileDocument(document);
    }
  }

  const customBanner = bannerCustom && isAllowedBannerColor(bannerColor);
  const invalidBanner = bannerCustom && !isAllowedBannerColor(bannerColor);

  return (
    <div className="relative overflow-hidden">
      <PageIllustration />

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 md:py-20">
        <div className="card overflow-hidden">
          <div
            className="h-16 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-400 dark:from-brand-800 dark:via-brand-600 dark:to-brand-500"
            style={
              customBanner
                ? { backgroundImage: bannerGradient(bannerColor) }
                : undefined
            }
          />
          <div className="px-6 pt-3 pb-7 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-5">
                <ProfileAvatar
                  photo={selectedPhoto}
                  initials={initials}
                  displayName={displayName}
                />
                <div className="min-w-0 pb-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h1 className="min-w-0 truncate font-display text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
                      {displayName}
                    </h1>
                    <SocialLinks links={links} />
                  </div>
                  <p className="mt-1.5 truncate text-sm text-ink-500 dark:text-ink-300">
                    {headline}
                  </p>
                  {accountEmail ? (
                    <p className="mt-1 truncate text-xs text-ink-500 dark:text-ink-300">
                      {accountEmail}
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={openProfileEditor}
                className="self-start px-6 sm:mt-1"
              >
                Edit profile
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-ink-200/70 bg-ink-50/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500 dark:text-ink-300">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-ink-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ProfileDocuments
          uploads={documentPool}
          cvId={cvUploadId}
          diplomaId={diplomaUploadId}
          certificationIds={certificationUploadIds}
          onPreview={setPreviewDocument}
        />

        <CollapsibleSection
          id="profile-information"
          title="Profile information"
          description={profileSummary}
          open={profileOpen}
          onOpenChange={setProfileOpen}
          className="mt-6"
        >
          <form onSubmit={submit} className="space-y-6" aria-busy={busy}>
            <Alert messages={messages} tone={tone} />

            <FormSection title="Cover colour" divider={false}>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  id="banner-color"
                  name="bannerColor"
                  value={bannerColor}
                  onChange={(event) => {
                    setBannerColor(event.target.value);
                    setBannerCustom(true);
                  }}
                  aria-label="Cover colour"
                  aria-describedby="banner-color-hint"
                  aria-invalid={invalidBanner ? true : undefined}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-ink-300 bg-white p-1 shadow-sm dark:border-white/15 dark:bg-white/5 dark:shadow-none"
                />
                <span className="font-mono text-xs text-ink-600 dark:text-ink-300">
                  {bannerColor}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setBannerColor(DEFAULT_BANNER_COLOR);
                    setBannerCustom(false);
                  }}
                >
                  Use brand red
                </Button>
              </div>
              <p
                id="banner-color-hint"
                className="mt-1 text-xs text-ink-500 dark:text-ink-400"
              >
                Choose a mid-tone colour; very pale, very dark or grey colours
                are rejected.
              </p>
              {invalidBanner ? (
                <p
                  role="alert"
                  className="mt-1 text-xs text-brand-600 dark:text-brand-300"
                >
                  Choose a stronger mid-tone colour before saving.
                </p>
              ) : null}
            </FormSection>

            <FormSection title="Personal details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="First name"
                  name="firstName"
                  value={form.firstName}
                  onChange={(event) => update('firstName')(event.target.value)}
                  autoComplete="given-name"
                  maxLength={100}
                  required
                />
                <Field
                  label="Last name"
                  name="lastName"
                  value={form.lastName}
                  onChange={(event) => update('lastName')(event.target.value)}
                  autoComplete="family-name"
                  maxLength={100}
                  required
                />
              </div>

              <Field
                label="Diploma"
                name="diploma"
                value={form.diploma ?? ''}
                onChange={(event) => update('diploma')(event.target.value)}
                hint="For example: Baccalauréat, Licence, or your current qualification."
                maxLength={200}
              />

              <Field
                label="University"
                name="university"
                value={form.university ?? ''}
                onChange={(event) => update('university')(event.target.value)}
                hint="Your current or most recent institution."
                maxLength={200}
              />
            </FormSection>

            <FormSection title="Skills & links">
              <Field
                label="Skills"
                name="skills"
                value={skillsInput}
                onChange={(event) => setSkillsInput(event.target.value)}
                hint="Comma-separated, up to 50. For example: React, Python, Arabic."
                maxLength={1000}
              />

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-ink-900 dark:text-white">
                  Links
                </legend>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  Add up to 10 portfolio or profile URLs (http/https).
                  Recognised Facebook, Instagram, X, LinkedIn, TikTok, YouTube
                  and GitHub links show as icons beside your name.
                </p>
                {links.map((link, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 sm:flex-row sm:items-end"
                  >
                    <div className="flex-1">
                      <Field
                        label={`Link ${index + 1}`}
                        name={`link-${index}`}
                        type="url"
                        value={link}
                        onChange={(event) =>
                          updateLink(index, event.target.value)
                        }
                        placeholder="https://…"
                        maxLength={2048}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => removeLink(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addLink}
                  disabled={links.length >= 10}
                >
                  Add link
                </Button>
              </fieldset>
            </FormSection>

            <FormSection title="Curriculum">
              <div className="space-y-3">
                {curriculum.map((row, index) => (
                  <div
                    key={index}
                    className="grid gap-4 rounded-xl border border-ink-200 p-4 sm:grid-cols-2 dark:border-white/10"
                  >
                    <Field
                      label="Institution"
                      name={`curriculum-${index}-institution`}
                      value={row.institution}
                      onChange={(event) =>
                        updateCurriculumRow(
                          index,
                          'institution'
                        )(event.target.value)
                      }
                      maxLength={200}
                      required
                    />
                    <Field
                      label="Degree"
                      name={`curriculum-${index}-degree`}
                      value={row.degree}
                      onChange={(event) =>
                        updateCurriculumRow(index, 'degree')(event.target.value)
                      }
                      maxLength={200}
                      required
                    />
                    <Field
                      label="Field (optional)"
                      name={`curriculum-${index}-field`}
                      value={row.field}
                      onChange={(event) =>
                        updateCurriculumRow(index, 'field')(event.target.value)
                      }
                      maxLength={200}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        label="Start year"
                        name={`curriculum-${index}-startYear`}
                        type="number"
                        min={1900}
                        max={2100}
                        value={row.startYear}
                        onChange={(event) =>
                          updateCurriculumRow(
                            index,
                            'startYear'
                          )(event.target.value)
                        }
                      />
                      <Field
                        label="End year"
                        name={`curriculum-${index}-endYear`}
                        type="number"
                        min={1900}
                        max={2100}
                        value={row.endYear}
                        onChange={(event) =>
                          updateCurriculumRow(
                            index,
                            'endYear'
                          )(event.target.value)
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setCurriculum((rows) =>
                            rows.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Remove entry
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setCurriculum((rows) => [...rows, EMPTY_CURRICULUM_ROW])
                  }
                >
                  Add curriculum entry
                </Button>
              </div>
            </FormSection>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={busy || invalidBanner}>
                {busy
                  ? 'Saving…'
                  : profileId
                    ? 'Save changes'
                    : 'Create profile'}
              </Button>
            </div>
          </form>
        </CollapsibleSection>

        <DocumentsPanel
          uploads={uploads}
          onUploadsChange={handleUploadsChange}
          onUploaded={handleUploaded}
          purpose={uploadPurpose}
          onPurposeChange={setUploadPurpose}
          open={documentsOpen}
          onOpenChange={setDocumentsOpen}
          profileId={profileId}
          attachments={{
            photoId: photoUploadId,
            cvId: cvUploadId,
            diplomaId: diplomaUploadId,
            certificationIds: certificationUploadIds,
          }}
          onSetProfileSlot={setProfileSlot}
          onPreview={setPreviewDocument}
        />
      </section>

      {previewDocument ? (
        <DocumentPreviewDialog
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      ) : null}
    </div>
  );
}
