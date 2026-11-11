import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadResponse } from '@sit/contract';

const getProfileMock = vi.hoisted(() => vi.fn());
const createProfileMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn());
const listUploadsMock = vi.hoisted(() => vi.fn());
const uploadFileMock = vi.hoisted(() => vi.fn());
const deleteUploadMock = vi.hoisted(() => vi.fn());
const downloadUploadMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>();
  return {
    ...actual,
    getProfile: getProfileMock,
    createProfile: createProfileMock,
    updateProfile: updateProfileMock,
    listUploads: listUploadsMock,
    uploadFile: uploadFileMock,
    deleteUpload: deleteUploadMock,
    downloadUpload: downloadUploadMock,
  };
});

vi.mock('../auth/session.ts', () => ({
  loadSession: () => ({
    account: { id: '1', email: 'student@example.com' },
    tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
  }),
}));

import { ApiError } from '../api/client.ts';
import ProfilePage from './ProfilePage';

const PHOTO: UploadResponse = {
  id: 'u1',
  accountId: '1',
  originalName: 'me.jpg',
  storageKey: 'key1.jpg',
  mimeType: 'image/jpeg',
  size: 100,
  purpose: 'PROFILE_PHOTO',
  createdAt: '2026-11-08T00:00:00.000Z',
};

const CV: UploadResponse = {
  id: 'u2',
  accountId: '1',
  originalName: 'cv.pdf',
  storageKey: 'key2.pdf',
  mimeType: 'application/pdf',
  size: 200,
  purpose: 'PROFILE_CV',
  createdAt: '2026-11-08T00:00:00.000Z',
};

const BASE_PROFILE = {
  id: 'profile-1',
  accountId: '1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  skills: [],
  links: [],
  curriculum: [],
  certifications: [],
};

describe('ProfilePage', () => {
  beforeEach(() => {
    getProfileMock.mockReset();
    createProfileMock.mockReset();
    updateProfileMock.mockReset();
    listUploadsMock.mockReset().mockResolvedValue([]);
    uploadFileMock.mockReset();
    deleteUploadMock.mockReset();
    downloadUploadMock
      .mockReset()
      .mockResolvedValue(new Blob(['bytes'], { type: 'image/jpeg' }));

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:document'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    if (typeof HTMLDialogElement !== 'undefined') {
      HTMLDialogElement.prototype.showModal = vi.fn(function (
        this: HTMLDialogElement
      ) {
        this.open = true;
      });
      HTMLDialogElement.prototype.close = vi.fn(function (
        this: HTMLDialogElement
      ) {
        this.open = false;
      });
    }
  });

  it('renders the new fields and creates a profile with parsed lists', async () => {
    getProfileMock.mockRejectedValueOnce(new ApiError(404, ['Not found.']));
    createProfileMock.mockResolvedValueOnce({
      id: 'profile-1',
      accountId: '1',
      firstName: 'Test',
      lastName: 'Student',
      skills: ['React', 'Python'],
      links: ['https://example.com'],
      curriculum: [{ institution: 'UTC', degree: 'Licence' }],
      certifications: [],
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText(/^first name$/i), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText(/^last name$/i), {
      target: { value: 'Student' },
    });
    fireEvent.change(screen.getByLabelText(/^skills$/i), {
      target: { value: 'React, Python ,React' },
    });
    fireEvent.change(screen.getByLabelText(/^cover colour$/i), {
      target: { value: '#3366cc' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add link$/i }));
    fireEvent.change(screen.getByLabelText(/^link 1$/i), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /add curriculum entry/i })
    );
    fireEvent.change(screen.getByLabelText(/^institution$/i), {
      target: { value: 'UTC' },
    });
    fireEvent.change(screen.getByLabelText(/^degree$/i), {
      target: { value: 'Licence' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create profile$/i }));

    await waitFor(() => {
      expect(createProfileMock).toHaveBeenCalledWith('access-token', {
        firstName: 'Test',
        lastName: 'Student',
        diploma: '',
        university: '',
        skills: ['React', 'Python'],
        links: ['https://example.com'],
        curriculum: [{ institution: 'UTC', degree: 'Licence' }],
        photoUploadId: null,
        cvUploadId: null,
        diplomaUploadId: null,
        certificationUploadIds: [],
        bannerColor: '#3366cc',
      });
    });
    expect(await screen.findByText(/profile saved/i)).toBeTruthy();
  });

  it('segments the editor into sections with the colour picker first', async () => {
    getProfileMock.mockRejectedValueOnce(new ApiError(404, ['Not found.']));

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { name: /^cover colour$/i })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /^personal details$/i })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /^skills & links$/i })
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^curriculum$/i })).toBeTruthy();

    // The cover-colour control is the first field in document order.
    const color = screen.getByLabelText(/^cover colour$/i);
    const firstName = screen.getByLabelText(/^first name$/i);
    expect(
      color.compareDocumentPosition(firstName) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('loads an existing profile into the form including new fields', async () => {
    getProfileMock.mockResolvedValueOnce({
      ...BASE_PROFILE,
      diploma: 'Bac',
      university: 'UTM',
      skills: ['Math', 'Poetry'],
      links: ['https://ada.example'],
      bannerColor: '#3366cc',
      curriculum: [
        {
          institution: 'University of Tunis',
          degree: 'Licence',
          field: 'CS',
          startYear: 2020,
          endYear: 2023,
        },
      ],
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    // An existing profile starts collapsed; the header is the summary.
    expect(
      await screen.findByRole('heading', { name: /ada lovelace/i })
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /profile information/i })
    );

    expect(await screen.findByDisplayValue('Ada')).toBeTruthy();
    expect(screen.getByDisplayValue('Math, Poetry')).toBeTruthy();
    expect(screen.getByDisplayValue('https://ada.example')).toBeTruthy();
    expect(screen.getByDisplayValue('University of Tunis')).toBeTruthy();
    expect(screen.getByDisplayValue('2020')).toBeTruthy();
    expect(screen.getByDisplayValue('2023')).toBeTruthy();
    expect(
      (screen.getByLabelText(/^cover colour$/i) as HTMLInputElement).value
    ).toBe('#3366cc');
  });

  it('renders social icons only for recognised profile links', async () => {
    getProfileMock.mockResolvedValueOnce({
      ...BASE_PROFILE,
      links: [
        'https://facebook.com/ada',
        'https://x.com/ada',
        'https://example.com/ada',
      ],
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const facebook = await screen.findByRole('link', {
      name: /facebook profile/i,
    });
    expect(facebook.getAttribute('href')).toBe('https://facebook.com/ada');
    expect(screen.getByRole('link', { name: /^x profile$/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example profile/i })).toBeNull();
  });

  it('attaches documents through the … menu and persists each slot', async () => {
    getProfileMock.mockResolvedValueOnce(BASE_PROFILE);
    listUploadsMock.mockResolvedValue([PHOTO, CV]);
    updateProfileMock
      .mockResolvedValueOnce({
        ...BASE_PROFILE,
        photo: {
          id: 'u1',
          originalName: 'me.jpg',
          storageKey: 'key1.jpg',
          mimeType: 'image/jpeg',
          size: 100,
          createdAt: '2026-11-08T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        ...BASE_PROFILE,
        photo: {
          id: 'u1',
          originalName: 'me.jpg',
          storageKey: 'key1.jpg',
          mimeType: 'image/jpeg',
          size: 100,
          createdAt: '2026-11-08T00:00:00.000Z',
        },
        cv: {
          id: 'u2',
          originalName: 'cv.pdf',
          storageKey: 'key2.pdf',
          mimeType: 'application/pdf',
          size: 200,
          createdAt: '2026-11-08T00:00:00.000Z',
        },
      });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { name: /ada lovelace/i })
    ).toBeTruthy();

    const photoRow = screen
      .getByLabelText(/actions for me.jpg/i)
      .closest('li') as HTMLElement;
    fireEvent.click(within(photoRow).getByLabelText(/actions for me.jpg/i));
    fireEvent.click(
      within(photoRow).getByRole('button', {
        name: /set as profile photo/i,
      })
    );
    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenNthCalledWith(1, 'access-token', {
        photoUploadId: 'u1',
      });
    });

    const cvRow = screen
      .getByLabelText(/actions for cv.pdf/i)
      .closest('li') as HTMLElement;
    fireEvent.click(within(cvRow).getByLabelText(/actions for cv.pdf/i));
    fireEvent.click(
      within(cvRow).getByRole('button', { name: /^set as cv$/i })
    );
    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenNthCalledWith(2, 'access-token', {
        cvUploadId: 'u2',
      });
    });
  });

  it('shows a selected profile photo in the header', async () => {
    getProfileMock.mockRejectedValueOnce(new ApiError(404, ['Not found.']));
    listUploadsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([PHOTO]);
    uploadFileMock.mockResolvedValueOnce(PHOTO);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    // A fresh account opens the profile form immediately.
    await screen.findByLabelText(/^first name$/i);

    fireEvent.click(
      screen.getByRole('button', { name: /^upload a document$/i })
    );
    fireEvent.change(screen.getByLabelText(/^upload as$/i), {
      target: { value: 'PROFILE_PHOTO' },
    });

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(['bytes'], 'me.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /^upload document$/i }));

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(
        'access-token',
        file,
        'PROFILE_PHOTO'
      );
    });
    expect(
      await screen.findByRole('img', { name: /profile photo/i })
    ).toBeTruthy();
  });

  it('previews an attached CV in an in-page dialog', async () => {
    getProfileMock.mockResolvedValueOnce({
      ...BASE_PROFILE,
      cv: {
        id: 'u2',
        originalName: 'cv.pdf',
        storageKey: 'key2.pdf',
        mimeType: 'application/pdf',
        size: 200,
        createdAt: '2026-11-08T00:00:00.000Z',
      },
    });
    listUploadsMock.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /ada lovelace/i });
    fireEvent.click(
      await screen.findByRole('button', { name: /preview cv.pdf/i })
    );

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(await screen.findByTitle(/preview of cv.pdf/i)).toBeTruthy();
  });
});
