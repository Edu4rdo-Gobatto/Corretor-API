import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn, IsInt, IsString, IsUrl, Matches, Max, Min, MinLength,
  Validate, ValidatorConstraint, validateSync,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'neonDatabaseUrl', async: false })
class NeonDatabaseUrl implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      const connection = new URL(value);
      // pg query parameters can override the authority and even disable explicit TLS.
      const parameters = [...connection.searchParams.keys()];
      const hasSupportedParameters = parameters.every((parameter) =>
        ['sslmode', 'channel_binding'].includes(parameter)
        && connection.searchParams.getAll(parameter).length === 1,
      );
      return ['postgres:', 'postgresql:'].includes(connection.protocol)
        && hasSupportedParameters
        && connection.hostname.endsWith('.neon.tech')
        && Boolean(connection.username && connection.password)
        && connection.pathname.length > 1
        && ['require', 'verify-ca', 'verify-full'].includes(connection.searchParams.get('sslmode') ?? '');
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'DATABASE_URL deve ser uma URL PostgreSQL do Neon com usuário, senha, banco e sslmode=require ou verify-full';
  }
}

export class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @Validate(NeonDatabaseUrl)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  @Matches(/\S/)
  JWT_SECRET!: string;

  @Matches(/^[1-9]\d*(s|m|h|d)$/)
  JWT_EXPIRES_IN = '7d';

  @IsUrl({ protocols: ['https'], require_protocol: true })
  R2_ENDPOINT!: string;

  @IsString()
  @Matches(/\S/)
  R2_ACCESS_KEY_ID!: string;

  @IsString()
  @Matches(/\S/)
  R2_SECRET_ACCESS_KEY!: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  R2_PUBLIC_URL!: string;
}

export function validateEnvironment(environment: Record<string, unknown>): EnvironmentVariables {
  const configuration = plainToInstance(EnvironmentVariables, environment);
  const errors = validateSync(configuration, {
    skipMissingProperties: false,
    whitelist: true,
    validationError: { target: false, value: false },
  });

  if (errors.length > 0) {
    // Only field names are reported: validator messages may interpolate secrets.
    const fields = errors.map((error) => error.property).join(', ');
    throw new Error(`Configuração de ambiente inválida: ${fields}. Consulte .env.example.`);
  }

  return configuration;
}
