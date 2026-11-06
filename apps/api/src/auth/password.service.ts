import { Injectable, BadRequestException } from '@nestjs/common';
import argon2 from 'argon2';

/**
 * PasswordService handles memory-hard password hashing with argon2id
 * (E1-US1.b) and password policy validation.
 *
 * Cost parameters are read from environment variables with secure defaults
 * matching .env.example: memory 65536 KiB, 3 iterations, 4 parallel lanes.
 */
@Injectable()
export class PasswordService {
  private readonly memoryCost: number;
  private readonly timeCost: number;
  private readonly parallelism: number;

  constructor() {
    this.memoryCost = Number(process.env.ARGON2_MEMORY_COST) || 65536;
    this.timeCost = Number(process.env.ARGON2_TIME_COST) || 3;
    this.parallelism = Number(process.env.ARGON2_PARALLELISM) || 4;
  }

  /**
   * Hashes a plaintext password with argon2id after validating policy.
   * Returns the encoded hash string (includes salt, params, and hash) —
   * safe to store directly in the database.
   */
  async hash(password: string): Promise<string> {
    this.validatePassword(password);
    return argon2.hash(password, {
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
      parallelism: this.parallelism,
      type: argon2.argon2id,
    });
  }

  /**
   * Verifies a plaintext password against an encoded argon2 hash.
   * Returns true if the password matches, false otherwise.
   */
  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // argon2.verify throws on malformed hashes — treat as non-match
      return false;
    }
  }

  /**
   * Validates password policy before hashing.
   * Throws BadRequestException on the first violated rule.
   */
  validatePassword(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new BadRequestException('Password is required.');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }
    if (password.length > 128) {
      throw new BadRequestException('Password must not exceed 128 characters.');
    }
    if (!/[A-Za-z]/.test(password)) {
      throw new BadRequestException('Password must contain at least one letter.');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Password must contain at least one digit.');
    }
  }
}
