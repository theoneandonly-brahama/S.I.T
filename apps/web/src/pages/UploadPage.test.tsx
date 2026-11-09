import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listUploadsMock = vi.hoisted(() => vi.fn());
const uploadFileMock = vi.hoisted(() => vi.fn());
const deleteUploadMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>();
  return {
    ...actual,
    listUploads: listUploadsMock,
    uploadFile: uploadFileMock,
    deleteUpload: deleteUploadMock,
  };
});

vi.mock('../auth/session.ts', () => ({
  loadSession: () => ({
    account: { id: '1', email: 'student@example.com' },
    tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
  }),
}));

import UploadPage from './UploadPage';

describe('UploadPage', () => {
  beforeEach(() => {
    listUploadsMock.mockReset().mockResolvedValue([]);
    uploadFileMock.mockReset();
    deleteUploadMock.mockReset();
  });

  it('renders the purpose selector with the general default', async () => {
    render(
      <MemoryRouter>
        <UploadPage />
      </MemoryRouter>
    );

    const select = (await screen.findByLabelText(
      /^upload as$/i
    )) as HTMLSelectElement;
    expect(select.value).toBe('GENERAL');
    expect(
      screen.getAllByText(/jpeg, png, gif, webp or pdf/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('uploads with the selected purpose and narrows the file filter', async () => {
    uploadFileMock.mockResolvedValueOnce({
      id: 'u1',
      accountId: '1',
      originalName: 'me.jpg',
      storageKey: 'key1.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      purpose: 'PROFILE_PHOTO',
      createdAt: '2026-11-08T00:00:00.000Z',
    });
    listUploadsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'u1',
        accountId: '1',
        originalName: 'me.jpg',
        storageKey: 'key1.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        purpose: 'PROFILE_PHOTO',
        createdAt: '2026-11-08T00:00:00.000Z',
      },
    ]);

    render(
      <MemoryRouter>
        <UploadPage />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText(/^upload as$/i), {
      target: { value: 'PROFILE_PHOTO' },
    });
    expect(screen.getByText(/jpeg or png up to 2 mb/i)).toBeTruthy();

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input.accept).toBe('image/jpeg,image/png');

    const file = new File(['bytes'], 'me.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload document/i }));

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(
        'access-token',
        file,
        'PROFILE_PHOTO'
      );
    });
    expect(await screen.findByText(/document uploaded/i)).toBeTruthy();
    expect(screen.getByText(/profile_photo/i)).toBeTruthy();
  });
});
