import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type {
  CreateProfileRequest,
  CurriculumEntry,
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
import Alert, { type AlertTone } from '../components/ui/Alert.tsx';
import Button from '../components/ui/Button.tsx';
import Field from '../components/ui/Field.tsx';

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
 * Profile editor with create/patch semantics: if the account has no
 * profile yet the first submission POSTs, afterwards submissions PATCH
 * (unchanged fields are sent too — the API preserves them).
 * Unauthenticated visits are redirected to /login.
 */
export default function ProfilePage() {
  const [form, setForm] = useState<CreateProfileRequest>(EMPTY_FORM);
  const [skillsInput, setSkillsInput] = useState('');
  const [linksInput, setLinksInput] = useState('');
  const [curriculum, setCurriculum] = useState<CurriculumDraft[]>([]);
  const [uploads, setUploads] = useState<UploadResponse[]>([]);
  const [photoUploadId, setPhotoUploadId] = useState<string>('');
  const [cvUploadId, setCvUploadId] = useState<string>('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [tone, setTone] = useState<AlertTone>('error');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }
    getProfile(session.tokens.accessToken)
      .then((profile) => {
        setProfileId(profile.id);
        setForm({
          firstName: profile.firstName,
          lastName: profile.lastName,
          diploma: profile.diploma ?? '',
          university: profile.university ?? '',
          skills: profile.skills ?? [],
          links: profile.links ?? [],
          curriculum: profile.curriculum ?? [],
        });
        setSkillsInput((profile.skills ?? []).join(', '));
        setLinksInput((profile.links ?? []).join(', '));
        setCurriculum((profile.curriculum ?? []).map(toDraft));
        setPhotoUploadId(profile.photo?.id ?? '');
        setCvUploadId(profile.cv?.id ?? '');
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          // Expected for a fresh account: start with an empty editor.
          setProfileId(null);
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
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      navigate('/login');
      return;
    }
    const { accessToken } = session.tokens;
    const payload: CreateProfileRequest = {
      ...form,
      skills: parseList(skillsInput),
      links: parseList(linksInput),
      curriculum: curriculum.map(toEntry),
      // Empty selection detaches the slot (null); the API re-checks
      // ownership, purpose, MIME and size for attached uploads.
      photoUploadId: photoUploadId || null,
      cvUploadId: cvUploadId || null,
    };
    setBusy(true);
    setMessages([]);
    try {
      const saved = profileId
        ? await updateProfile(accessToken, payload)
        : await createProfile(accessToken, payload);
      setProfileId(saved.id);
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

  if (loading) {
    return (
      <div className="relative overflow-hidden">
        <PageIllustration />
        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
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

  return (
    <div className="relative overflow-hidden">
      <PageIllustration />

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
            Your profile
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900 dark:text-white">
            Tell us about you
          </h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
            This information helps us match you with the right programmes and
            opportunities.
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
            <Alert messages={messages} tone={tone} />

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

            <Field
              label="Skills"
              name="skills"
              value={skillsInput}
              onChange={(event) => setSkillsInput(event.target.value)}
              hint="Comma-separated, up to 50. For example: React, Python, Arabic."
              maxLength={1000}
            />

            <Field
              label="Links"
              name="links"
              value={linksInput}
              onChange={(event) => setLinksInput(event.target.value)}
              hint="Comma-separated portfolio or profile URLs (http/https), up to 10."
              maxLength={2000}
            />

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-ink-900 dark:text-white">
                Curriculum
              </legend>
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
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-ink-900 dark:text-white">
                Documents
              </legend>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                Upload files on the Documents page first (as Profile photo or
                CV), then attach them here. Choose “None” to detach.
              </p>
              {(
                [
                  [
                    'Profile photo',
                    'PROFILE_PHOTO',
                    photoUploadId,
                    setPhotoUploadId,
                  ],
                  ['CV', 'PROFILE_CV', cvUploadId, setCvUploadId],
                ] as Array<
                  [string, UploadPurpose, string, (value: string) => void]
                >
              ).map(([label, purpose, value, setValue]) => {
                const options = uploads.filter((u) => u.purpose === purpose);
                return (
                  <div key={purpose}>
                    <label className="form-label" htmlFor={`attach-${purpose}`}>
                      {label}
                    </label>
                    <select
                      id={`attach-${purpose}`}
                      name={`attach-${purpose}`}
                      className="form-input"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    >
                      <option value="">None</option>
                      {options.map((upload) => (
                        <option key={upload.id} value={upload.id}>
                          {upload.originalName} ({upload.mimeType})
                        </option>
                      ))}
                    </select>
                    {options.length === 0 && (
                      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                        No {label.toLowerCase()} uploaded yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </fieldset>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={busy}>
                {busy
                  ? 'Saving…'
                  : profileId
                    ? 'Save changes'
                    : 'Create profile'}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
