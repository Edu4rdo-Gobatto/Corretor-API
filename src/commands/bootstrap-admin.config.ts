import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AgentRole } from '../agents/agent.entity';
import { CreateAgentDto } from '../agents/dto/create-agent.dto';

export function parseBootstrapAdministrator(environment: NodeJS.ProcessEnv): CreateAgentDto {
  const dto = plainToInstance(CreateAgentDto, {
    name: environment.BOOTSTRAP_ADMIN_NAME,
    email: environment.BOOTSTRAP_ADMIN_EMAIL,
    password: environment.BOOTSTRAP_ADMIN_PASSWORD,
    whatsappNumber: environment.BOOTSTRAP_ADMIN_WHATSAPP,
    role: AgentRole.ADMIN,
  });
  const errors = validateSync(dto, { validationError: { target: false, value: false } });
  if (errors.length) {
    const environmentFields: Record<string, string> = {
      name: 'BOOTSTRAP_ADMIN_NAME', email: 'BOOTSTRAP_ADMIN_EMAIL',
      password: 'BOOTSTRAP_ADMIN_PASSWORD', whatsappNumber: 'BOOTSTRAP_ADMIN_WHATSAPP',
    };
    const fields = errors.map((error) => environmentFields[error.property]).join(', ');
    throw new Error(`Configuração inicial inválida: ${fields}. Consulte .env.example.`);
  }
  return dto;
}
