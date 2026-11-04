import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatus() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }
}
