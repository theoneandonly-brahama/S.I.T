import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ConfirmationDeliveryService } from './confirmation-delivery.service.js';

describe('ConfirmationDeliveryService', () => {
  const service = new ConfirmationDeliveryService();

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logs the token in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await service.deliver('student@example.com', 'secret-token');

    expect(log).toHaveBeenCalledWith(expect.stringContaining('secret-token'));
  });

  it('stays silent in the test environment', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await service.deliver('student@example.com', 'secret-token');

    expect(log).not.toHaveBeenCalled();
  });

  it('does not log the token in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.deliver('student@example.com', 'secret-token');

    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).not.toContain('secret-token');
  });
});
