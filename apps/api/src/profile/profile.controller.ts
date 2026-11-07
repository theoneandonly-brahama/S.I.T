import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { ProfileService } from './profile.service.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateProfileDto, UpdateProfileDto } from './dto/profile.dto.js';

interface RequestUser {
  sub: string;
  email: string;
}

/**
 * ProfileController exposes profile management endpoints.
 *
 *   POST   /profile  — create a profile for the current user
 *   GET    /profile  — get the current user's profile
 *   PATCH  /profile  — update the current user's profile
 *
 * All routes require a valid JWT access token (JwtAuthGuard).
 * Ownership is implicit: profiles are looked up by accountId from the
 * decoded token, so callers can only manage their own profile.
 */
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    @Inject(ProfileService) private readonly profileService: ProfileService
  ) {}

  /**
   * Creates a profile for the authenticated account.
   * Returns 409 if a profile already exists for this account.
   */
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateProfileDto
  ) {
    return this.profileService.create(user.sub, dto);
  }

  /**
   * Returns the authenticated account's profile.
   * Returns 404 if no profile exists.
   */
  @Get()
  async get(@CurrentUser() user: RequestUser) {
    return this.profileService.findByAccountId(user.sub);
  }

  /**
   * Updates the authenticated account's profile.
   * Returns 404 if no profile exists.
   * Only provided fields are patched.
   */
  @Patch()
  async update(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto
  ) {
    return this.profileService.update(user.sub, dto);
  }
}
