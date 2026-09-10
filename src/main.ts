import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.create(AppModule);
  const configuration = application.get(ConfigService);
  const httpServer = application.getHttpAdapter().getInstance() as { set: (setting: string, value: number) => void };
  httpServer.set('trust proxy', 1);
  application.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  application.enableShutdownHooks();
  await application.listen(configuration.getOrThrow<number>('PORT'), '0.0.0.0');
}

void bootstrap();
