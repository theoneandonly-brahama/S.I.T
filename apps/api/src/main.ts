import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HealthModule } from './health/health.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(HealthModule);
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
