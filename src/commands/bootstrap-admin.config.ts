import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CargoCorretor, CriarCorretorDto } from '../corretores/corretores.dto';

export function parseBootstrapAdministrator(environment: NodeJS.ProcessEnv): CriarCorretorDto {
  const dto = plainToInstance(CriarCorretorDto, {
    nome: environment.BOOTSTRAP_ADMIN_NAME,
    email: environment.BOOTSTRAP_ADMIN_EMAIL,
    senha: environment.BOOTSTRAP_ADMIN_PASSWORD,
    whatsapp: environment.BOOTSTRAP_ADMIN_WHATSAPP,
    cpf: environment.BOOTSTRAP_ADMIN_CPF,
    cargo: CargoCorretor.ADMIN,
  });
  const errors = validateSync(dto, { validationError: { target: false, value: false } });
  if (errors.length) {
    const environmentFields: Record<string, string> = {
      nome: 'BOOTSTRAP_ADMIN_NAME', email: 'BOOTSTRAP_ADMIN_EMAIL',
      senha: 'BOOTSTRAP_ADMIN_PASSWORD', whatsapp: 'BOOTSTRAP_ADMIN_WHATSAPP', cpf: 'BOOTSTRAP_ADMIN_CPF',
    };
    const fields = errors.map((error) => environmentFields[error.property]).join(', ');
    throw new Error(`Configuração inicial inválida: ${fields}. Consulte .env.example.`);
  }
  return dto;
}
