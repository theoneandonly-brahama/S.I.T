import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Controller, Get, Injectable, Module } from '@nestjs/common';

@Injectable()
class HealthService {
  getStatus() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }
}

@Controller('health')
class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check() {
    return this.health.getStatus();
  }
}

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
class HealthModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(HealthModule);
  await app.listen(3000, '0.0.0.0');
}

bootstrap();
