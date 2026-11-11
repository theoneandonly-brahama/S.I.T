import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadPurpose, UploadResponse } from '@sit/contract';

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

import DocumentsPanel from './DocumentsPanel';

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

const EMPTY_ATTACHMENTS = {
  photoId: '',
  cvId: '',
  diplomaId: '',
  certificationIds: [] as string[],
};

interface HarnessProps {
  uploads: UploadResponse[];
  onUploadsChange: (uploads: UploadResponse[]) => void;
  onUploaded?: (upload: UploadResponse) => void;
  initialPurpose?: UploadPurpose;
  initialOpen?: boolean;
  profileId?: string | null;
  attachments?: typeof EMPTY_ATTACHMENTS;
  onSetProfileSlot?: (
    upload: UploadResponse,
    slot: 'photo' | 'cv' | 'diploma' | 'certification',
    attach: boolean
  ) => Promise<void>;
  onPreview?: (document: UploadResponse) => void;
}

/** Holds the controlled purpose/open state the real parent owns. */
function Harness({
  uploads,
  onUploadsChange,
  onUploaded,
  initialPurpose = 'GENERAL',
  initialOpen = true,
  profileId = 'profile-1',
  attachments = EMPTY_ATTACHMENTS,
  onSetProfileSlot = vi.fn(async () => {}),
  onPreview = vi.fn(),
}: HarnessProps) {
  const [purpose, setPurpose] = useState<UploadPurpose>(initialPurpose);
  const [open, setOpen] = useState(initialOpen);

  return (
    <MemoryRouter>
      <DocumentsPanel
        uploads={uploads}
        onUploadsChange={onUploadsChange}
        onUploaded={onUploaded}
        purpose={purpose}
        onPurposeChange={setPurpose}
        open={open}
        onOpenChange={setOpen}
        profileId={profileId}
        attachments={attachments}
        onSetProfileSlot={onSetProfileSlot}
        onPreview={onPreview}
      />
    </MemoryRouter>
  );
}

describe('DocumentsPanel', () => {
  beforeEach(() => {
    listUploadsMock.mockReset().mockResolvedValue([]);
    uploadFileMock.mockReset();
    deleteUploadMock.mockReset();
  });

  it('renders the purpose selector with the general default', () => {
    render(
      <Harness uploads={[]} onUploadsChange={vi.fn()} initialOpen={true} />
    );

    const select = screen.getByLabelText(/^upload as$/i) as HTMLSelectElement;
    expect(select.value).toBe('GENERAL');
    expect(
      screen.getAllByText(/jpeg, png, gif, webp or pdf/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('toggles the upload form without hiding the owned file list', () => {
    render(
      <Harness
        uploads={[PHOTO]}
        onUploadsChange={vi.fn()}
        initialOpen={false}
      />
    );

    expect(screen.queryByLabelText(/^upload as$/i)).toBeNull();
    expect(screen.getByText('me.jpg')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /^upload a document$/i })
    );
    expect(screen.getByLabelText(/^upload as$/i)).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /^close document upload$/i })
    );
    expect(screen.queryByLabelText(/^upload as$/i)).toBeNull();
    expect(screen.getByText('me.jpg')).toBeTruthy();
  });

  it('uploads with the selected purpose, refreshes the list and reports the upload', async () => {
    uploadFileMock.mockResolvedValueOnce(PHOTO);
    listUploadsMock.mockResolvedValueOnce([PHOTO]);
    const onUploadsChange = vi.fn();
    const onUploaded = vi.fn();

    render(
      <Harness
        uploads={[]}
        onUploadsChange={onUploadsChange}
        onUploaded={onUploaded}
      />
    );

    fireEvent.change(screen.getByLabelText(/^upload as$/i), {
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
    expect(onUploadsChange).toHaveBeenCalledWith([PHOTO]);
    expect(onUploaded).toHaveBeenCalledWith(PHOTO);
  });

  it('deletes a document through the … menu and reports the refreshed list', async () => {
    deleteUploadMock.mockResolvedValueOnce(undefined);
    listUploadsMock.mockResolvedValueOnce([]);
    const onUploadsChange = vi.fn();

    render(
      <Harness
        uploads={[PHOTO]}
        onUploadsChange={onUploadsChange}
        initialOpen={false}
      />
    );

    fireEvent.click(screen.getByLabelText(/actions for me.jpg/i));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteUploadMock).toHaveBeenCalledWith('access-token', 'key1.jpg');
    });
    expect(await screen.findByText(/document deleted/i)).toBeTruthy();
    expect(onUploadsChange).toHaveBeenCalledWith([]);
  });

  it('attaches a document as a profile slot through the … menu', async () => {
    const onSetProfileSlot = vi.fn(async () => {});
    const onUploadsChange = vi.fn();

    render(
      <Harness
        uploads={[PHOTO]}
        onUploadsChange={onUploadsChange}
        initialOpen={false}
        onSetProfileSlot={onSetProfileSlot}
      />
    );

    fireEvent.click(screen.getByLabelText(/actions for me.jpg/i));
    fireEvent.click(
      screen.getByRole('button', { name: /set as profile photo/i })
    );

    await waitFor(() => {
      expect(onSetProfileSlot).toHaveBeenCalledWith(PHOTO, 'photo', true);
    });
    expect(await screen.findByText(/document attached/i)).toBeTruthy();
  });

  it('offers a preview from the … menu', () => {
    const onPreview = vi.fn();

    render(
      <Harness
        uploads={[CV]}
        onUploadsChange={vi.fn()}
        initialOpen={false}
        onPreview={onPreview}
      />
    );

    fireEvent.click(screen.getByLabelText(/actions for cv.pdf/i));
    fireEvent.click(screen.getByRole('button', { name: /^preview$/i }));

    expect(onPreview).toHaveBeenCalledWith(CV);
  });

  it('disables slot actions that the file cannot satisfy', () => {
    render(
      <Harness
        uploads={[PHOTO]}
        onUploadsChange={vi.fn()}
        initialOpen={false}
      />
    );

    fireEvent.click(screen.getByLabelText(/actions for me.jpg/i));

    expect(
      (
        screen.getByRole('button', {
          name: /set as profile photo/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    expect(
      (
        screen.getByRole('button', {
          name: /set as cv/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('explains that a profile must exist before attaching', () => {
    render(
      <Harness
        uploads={[PHOTO]}
        onUploadsChange={vi.fn()}
        initialOpen={false}
        profileId={null}
      />
    );

    fireEvent.click(screen.getByLabelText(/actions for me.jpg/i));

    expect(
      screen.getByText(/create your profile before attaching documents/i)
    ).toBeTruthy();
  });
});
