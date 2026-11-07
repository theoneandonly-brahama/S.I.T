import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AccountService } from '../account/account.service.js';
import { SessionService } from '../session/session.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

const mockAccountService = {
  findByEmail: vi.fn(),
} as unknown as AccountService;

const mockSessionService = {} as unknown as SessionService;

const mockPasswordService = {
  hash: vi.fn(),
  verify: vi.fn(),
} as unknown as PasswordService;

const mockTokenService = {} as unknown as TokenService;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AuthService', () => {
  const service = new AuthService(
    mockAccountService,
    mockSessionService,
    mockPasswordService,
    mockTokenService
  );

  it('returns account id and email on successful authentication', async () => {
    mockAccountService.findByEmail.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      passwordHash: 'hash',
    });
    mockPasswordService.verify.mockResolvedValue(true);

    const result = await service.authenticate('a@b.com', 'pass');
    expect(result).toEqual({ id: '1', email: 'a@b.com' });
  });

  it('throws the same UnauthorizedException when account does not exist', async () => {
    mockAccountService.findByEmail.mockResolvedValue(null);
    mockPasswordService.hash.mockResolvedValue('dummy-hash');

    await expect(service.authenticate('nope@b.com', 'pass')).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('throws the same UnauthorizedException when password is wrong', async () => {
    mockAccountService.findByEmail.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      passwordHash: 'hash',
    });
    mockPasswordService.verify.mockResolvedValue(false);

    await expect(service.authenticate('a@b.com', 'wrong')).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('runs argon2 against a dummy hash when account is missing (timing mitigation)', async () => {
    mockAccountService.findByEmail.mockResolvedValue(null);
    mockPasswordService.hash.mockResolvedValue('dummy-hash');
    mockPasswordService.verify.mockResolvedValue(false);

    await expect(service.authenticate('nope@b.com', 'pass')).rejects.toThrow(
      UnauthorizedException
    );
    // Timing mitigation: argon2 still runs against a dummy hash when account
    // is missing, so timing does not reveal account existence.
    // Timing mitigation: argon2 still runs against a dummy hash when account
    // is missing, so timing does not reveal account existence.
    expect(mockPasswordService.hash).toHaveBeenCalledWith(
      '__dummy_account_123__'
    );
    expect(mockPasswordService.verify).not.toHaveBeenCalled();
  });
});
