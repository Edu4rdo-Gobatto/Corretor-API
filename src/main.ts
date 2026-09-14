import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.create(AppModule);
  application.use(helmet());
  application.useGlobalFilters(new GlobalExceptionFilter());
  application.setGlobalPrefix('api/v1');
  application.use((request: { url: string }, _response: unknown, next: () => void) => {
    if (!request.url.startsWith('/api/v1')) request.url = `/api/v1${request.url}`;
    next();
  });
  const configuration = application.get(ConfigService);
  const httpServer = application.getHttpAdapter().getInstance() as { set: (setting: string, value: number) => void };
  httpServer.set('trust proxy', 1);
  application.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  application.enableCors({ origin: configuration.getOrThrow<string>('ALLOWED_ORIGINS').split(',').map(origem => origem.trim()), credentials: true });
  application.enableShutdownHooks();
  await application.listen(configuration.getOrThrow<number>('PORT'), '0.0.0.0');
}

void bootstrap();
