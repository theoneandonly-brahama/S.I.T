import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService
  ) {}

  @SkipThrottle()
  @Get()
  check() {
    return this.healthService.getStatus();
  }
}
