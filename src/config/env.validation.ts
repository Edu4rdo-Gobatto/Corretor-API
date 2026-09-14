import 'reflect-metadata';
import { createPrivateKey } from 'node:crypto';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn, IsInt, IsString, IsUrl, IsEmail, Matches, Max, Min, MinLength, ValidateIf,
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
  JWT_EXPIRES_IN = '15m';

  @IsString()
  @Matches(/^https?:\/\/[^\s,/]+(,https?:\/\/[^\s,/]+)*$/)
  ALLOWED_ORIGINS = 'http://localhost:5173';

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

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== '')
  @IsEmail()
  GOOGLE_DRIVE_CLIENT_EMAIL?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== '')
  @IsString()
  GOOGLE_DRIVE_PRIVATE_KEY?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== '')
  @Matches(/^[A-Za-z0-9_-]+$/)
  GOOGLE_DRIVE_ROOT_FOLDER_ID?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== '')
  @Matches(/^[A-Za-z0-9_-]+$/)
  GOOGLE_DRIVE_SHARED_DRIVE_ID?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  R2_REQUEST_TIMEOUT_MS = 30000;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  R2_CONNECTION_TIMEOUT_MS = 5000;
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

  const camposDrive = ['GOOGLE_DRIVE_CLIENT_EMAIL', 'GOOGLE_DRIVE_PRIVATE_KEY', 'GOOGLE_DRIVE_ROOT_FOLDER_ID', 'GOOGLE_DRIVE_SHARED_DRIVE_ID'] as const;
  if (camposDrive.some(campo => Boolean(configuration[campo]))) {
    if (camposDrive.some(campo => !configuration[campo])) {
      throw new Error(`Configuração de ambiente inválida: configure juntos ${camposDrive.join(', ')}.`);
    }
    try {
      const chave = createPrivateKey(configuration.GOOGLE_DRIVE_PRIVATE_KEY!.replace(/\\n/g, '\n'));
      if (chave.asymmetricKeyType !== 'rsa' || (chave.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error();
    } catch {
      throw new Error('Configuração de ambiente inválida: GOOGLE_DRIVE_PRIVATE_KEY deve ser uma chave privada RSA válida.');
    }
  }

  return configuration;
}
