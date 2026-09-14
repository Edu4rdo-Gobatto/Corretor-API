import { PartialType, PickType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { DocumentoValido } from '../comum/validacao';

export enum CargoCorretor { ADMIN = 'ADMIN', CORRETOR = 'CORRETOR' }

const aparar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const normalizarContato = ({ value }: { value: unknown }) => typeof value === 'string' ? value.replace(/[.()\s+/-]/g, '') : value;

export class CriarCorretorDto {
  @Transform(aparar) @IsString() @Length(2, 100)
  nome!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254)
  email!: string;

  @IsString() @Length(12, 128) @Matches(/\S/)
  senha!: string;

  @Transform(normalizarContato) @Matches(/^\d{11}$/) @DocumentoValido()
  cpf!: string;

  @Transform(normalizarContato) @Matches(/^(?:55)?[1-9][0-9][0-9]{8,9}$/)
  whatsapp!: string;

  @IsOptional() @Transform(aparar) @IsString() @MaxLength(50)
  creci?: string | null;

  @IsEnum(CargoCorretor)
  cargo: CargoCorretor = CargoCorretor.CORRETOR;

  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048)
  url_foto?: string | null;
}

export class AtualizarCorretorDto extends PartialType(CriarCorretorDto, { skipNullProperties: false }) {
  override cargo?: CargoCorretor = undefined;
  @ValidateIf((_, valor: unknown) => valor !== undefined) @IsBoolean()
  ativo?: boolean;
}

export class AtualizarPerfilDto extends PartialType(PickType(CriarCorretorDto, ['nome', 'whatsapp', 'creci', 'url_foto'] as const), { skipNullProperties: false }) {}

export class AlterarSenhaDto {
  @IsString() @Length(1, 128)
  senha_atual!: string;

  @IsString() @Length(12, 128) @Matches(/\S/)
  nova_senha!: string;
}

export class ConsultarCorretoresDto {
  @Type(() => Number) @IsInt() @Min(1)
  pagina = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limite = 20;

  @IsOptional() @Transform(aparar) @IsString() @MaxLength(100)
  busca?: string;

  @ValidateIf((_, valor: unknown) => valor !== undefined)
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  ativo?: boolean;
}
