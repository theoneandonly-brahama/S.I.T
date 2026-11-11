// Typed API client for the S.I.T backend, consumed over same-origin
// `/api` (proxied to the API in development; reverse-proxied in
// production). Every route path is verified against apps/api source.
import type {
  AccountResponse,
  ChangeEmailRequest,
  ChangeEmailResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  CreateProfileRequest,
  LoginRequest,
  LoginResponse,
  ProfileResponse,
  RegisterRequest,
  RegisterResponse,
  ResendConfirmationRequest,
  ResendConfirmationResponse,
  UpdateProfileRequest,
  UploadPurpose,
  UploadResponse,
  UploadSignedAccessResponse,
  VerifyEmailResponse,
} from '@sit/contract';

const API_BASE = '/api';

/** Shape of the API's uniform error envelope (see AllExceptionsFilter). */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

/** Normalized error carrying every message the API sent back. */
export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join(' '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

interface RequestOptions {
  method?: string;
  /** JSON-serializable body (ignored when formData is supplied). */
  body?: unknown;
  /** Bearer token to attach to the Authorization header. */
  token?: string;
  /** Multipart payload sent verbatim (Content-Type set by the browser). */
  formData?: FormData;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.formData ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });

  // 204 has no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body: keep the null payload and depend on the status code.
  }

  if (!response.ok) {
    const body = payload as Partial<ApiErrorBody> | null;
    const raw = body?.message;
    const messages = Array.isArray(raw)
      ? raw
      : raw
        ? [raw]
        : [`Request failed with status ${response.status}.`];
    throw new ApiError(response.status, messages);
  }

  return payload as T;
}

/**
 * Fetches an upload as raw bytes. The download route is JWT-guarded, so
 * the browser cannot use a plain `<img src>`; callers turn the returned
 * Blob into an object URL and revoke it when the preview closes.
 */
async function requestBlob(path: string, token: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON error body: fall back to the status code.
    }
    const body = payload as Partial<ApiErrorBody> | null;
    const raw = body?.message;
    const messages = Array.isArray(raw)
      ? raw
      : raw
        ? [raw]
        : [`Request failed with status ${response.status}.`];
    throw new ApiError(response.status, messages);
  }

  return response.blob();
}

// ---------------------------------------------------------------------------
// Endpoint wrappers — one per verified API route.
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
}

export const getHealth = () => request<HealthResponse>('/health');

export const register = (dto: RegisterRequest) =>
  request<RegisterResponse>('/auth/register', { method: 'POST', body: dto });

export const verifyEmail = (token: string) =>
  request<VerifyEmailResponse>(
    `/confirmation-token/verify?token=${encodeURIComponent(token)}`
  );

export const resendConfirmation = (dto: ResendConfirmationRequest) =>
  request<ResendConfirmationResponse>('/confirmation-token/resend', {
    method: 'POST',
    body: dto,
  });

export const login = (dto: LoginRequest) =>
  request<LoginResponse>('/auth/login', { method: 'POST', body: dto });

export const logout = (token: string, refreshToken: string) =>
  request<void>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    token,
  });

export const changePassword = (token: string, dto: ChangePasswordRequest) =>
  request<ChangePasswordResponse>('/auth/change-password', {
    method: 'POST',
    body: dto,
    token,
  });

export const changeEmail = (token: string, dto: ChangeEmailRequest) =>
  request<ChangeEmailResponse>('/auth/change-email', {
    method: 'POST',
    body: dto,
    token,
  });

export const getMe = (token: string) =>
  request<AccountResponse>('/accounts/me', { token });

export const getProfile = (token: string) =>
  request<ProfileResponse>('/profile', { token });

export const createProfile = (token: string, dto: CreateProfileRequest) =>
  request<ProfileResponse>('/profile', { method: 'POST', body: dto, token });

export const updateProfile = (token: string, dto: UpdateProfileRequest) =>
  request<ProfileResponse>('/profile', { method: 'PATCH', body: dto, token });

export const listUploads = (token: string) =>
  request<UploadResponse[]>('/upload', { token });

export const uploadFile = (
  token: string,
  file: File,
  purpose: UploadPurpose = 'GENERAL'
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);
  return request<UploadResponse>('/upload', {
    method: 'POST',
    formData,
    token,
  });
};

export const deleteUpload = (token: string, storageKey: string) =>
  request<void>(`/upload/${encodeURI(storageKey)}`, {
    method: 'DELETE',
    token,
  });

export const downloadUpload = (token: string, storageKey: string) =>
  requestBlob(`/upload/${encodeURI(storageKey)}/download`, token);

export const getSignedAccess = (token: string, storageKey: string) =>
  request<UploadSignedAccessResponse>(
    `/upload/${encodeURI(storageKey)}/signed-access`,
    { token }
  );
