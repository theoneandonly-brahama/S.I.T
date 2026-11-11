import { describe, it, expect, vi } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function createHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status };
  const request = { url: '/upload', method: 'POST' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('maps a multer file-size error to 413 without logging it as unknown', () => {
    const error = Object.assign(new Error('File too large'), {
      name: 'MulterError',
      code: 'LIMIT_FILE_SIZE',
    });
    const { host, status, json } = createHost();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      new AllExceptionsFilter().catch(error, host);

      expect(status).toHaveBeenCalledWith(413);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 413,
          message: 'File too large.',
          error: 'PayloadTooLarge',
          path: '/upload',
          timestamp: expect.any(String),
        })
      );
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
