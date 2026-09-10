import 'dotenv/config';
import { ConflictException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AgentsService } from '../agents/agents.service';
import { parseBootstrapAdministrator } from './bootstrap-admin.config';

async function bootstrapAdministrator(): Promise<void> {
  // Validate secrets before loading the application or making any connection.
  const dto = parseBootstrapAdministrator(process.env);
  const { AppModule } = await import('../app.module');
  const application = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const administrator = await application.get(AgentsService).createInitialAdministrator(dto);
    console.log(`Administrador criado: ${administrator.id}`);
  } finally {
    await application.close();
  }
}

bootstrapAdministrator().catch((error: unknown) => {
  if (error instanceof ConflictException || (error instanceof Error && error.message.startsWith('Configuração'))) {
    console.error(error.message);
  } else {
    console.error('Falha ao criar administrador. Verifique a configuração do banco e execute as migrations.');
  }
  process.exitCode = 1;
});
