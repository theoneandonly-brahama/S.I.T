import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProfileMock = vi.hoisted(() => vi.fn());
const createProfileMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn());
const listUploadsMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>();
  return {
    ...actual,
    getProfile: getProfileMock,
    createProfile: createProfileMock,
    updateProfile: updateProfileMock,
    listUploads: listUploadsMock,
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

describe('ProfilePage', () => {
  beforeEach(() => {
    getProfileMock.mockReset();
    createProfileMock.mockReset();
    updateProfileMock.mockReset();
    listUploadsMock.mockReset().mockResolvedValue([]);
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
    fireEvent.change(screen.getByLabelText(/^links$/i), {
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
      });
    });
    expect(await screen.findByText(/profile saved/i)).toBeTruthy();
  });

  it('loads an existing profile into the form including new fields', async () => {
    getProfileMock.mockResolvedValueOnce({
      id: 'profile-1',
      accountId: '1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      diploma: 'Bac',
      university: 'UTM',
      skills: ['Math', 'Poetry'],
      links: ['https://ada.example'],
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

    expect(
      await screen.findByDisplayValue('Ada')
    ).toBeTruthy();
    expect(screen.getByDisplayValue('Math, Poetry')).toBeTruthy();
    expect(screen.getByDisplayValue('https://ada.example')).toBeTruthy();
    expect(screen.getByDisplayValue('University of Tunis')).toBeTruthy();
    expect(screen.getByDisplayValue('2020')).toBeTruthy();
    expect(screen.getByDisplayValue('2023')).toBeTruthy();
  });

  it('attaches uploaded photo and CV slots on save', async () => {
    getProfileMock.mockResolvedValueOnce({
      id: 'profile-1',
      accountId: '1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      skills: [],
      links: [],
      curriculum: [],
    });
    listUploadsMock.mockResolvedValue([
      {
        id: 'photo-1',
        accountId: '1',
        originalName: 'me.jpg',
        storageKey: 'key1.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        purpose: 'PROFILE_PHOTO',
        createdAt: '2026-11-08T00:00:00.000Z',
      },
      {
        id: 'cv-1',
        accountId: '1',
        originalName: 'cv.pdf',
        storageKey: 'key2.pdf',
        mimeType: 'application/pdf',
        size: 200,
        purpose: 'PROFILE_CV',
        createdAt: '2026-11-08T00:00:00.000Z',
      },
    ]);
    updateProfileMock.mockResolvedValueOnce({
      id: 'profile-1',
      accountId: '1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      skills: [],
      links: [],
      curriculum: [],
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    fireEvent.change(
      await screen.findByLabelText(/^profile photo$/i),
      { target: { value: 'photo-1' } }
    );
    fireEvent.change(screen.getByLabelText(/^cv$/i), {
      target: { value: 'cv-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith(
        'access-token',
        expect.objectContaining({
          photoUploadId: 'photo-1',
          cvUploadId: 'cv-1',
        })
      );
    });
  });
});
