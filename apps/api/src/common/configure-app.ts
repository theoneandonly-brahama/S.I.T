import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

/**
 * configureApp applies the application-wide HTTP configuration.
 *
 * Used by BOTH the production bootstrap (main.ts) and the integration
 * tests, so tests exercise the same validation and error-shaping
 * behaviour as production — no configuration drift.
 *
 * - ValidationPipe: validates every incoming DTO via class-validator.
 *   whitelist strips unknown properties; forbidNonWhitelisted rejects
 *   requests that carry them (400 instead of silent ignoring).
 *   transform converts plain payloads into DTO class instances.
 * - AllExceptionsFilter: uniform error envelope for every exception,
 *   with no internal details leaking to the client.
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new AllExceptionsFilter());
}
