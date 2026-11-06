import { describe, it, expect } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports a healthy status with a timestamp', () => {
    const service = new HealthService();
    const result = service.getStatus();

    expect(result.status).toBe('healthy');
    expect(typeof result.timestamp).toBe('string');
  });
});
