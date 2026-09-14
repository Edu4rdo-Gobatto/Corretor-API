import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { Equals, IsBoolean, IsISO8601, IsEmail, IsIn, IsInt, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { TelefoneValido } from '../comum/validacao';

const aparar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
class DadosContatoDto {
  @Transform(aparar) @IsString() @Length(2, 200) nome!: string;
  @Transform(aparar) @TelefoneValido() telefone!: string;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined && valor !== null)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254) email?: string | null;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined && valor !== null)
  @Transform(aparar) @IsString() @MaxLength(5000) mensagem?: string | null;
}

export class ClientePublicoDto extends DadosContatoDto {
  @IsUUID('4') imovel_id!: string;
  @IsBoolean() @Equals(true) consentimento!: true;
}

export class ClienteManualDto extends DadosContatoDto {
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined && valor !== null) @IsUUID('4') imovel_id?: string | null;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsUUID('4') corretor_id?: string;
}

export class AtualizarClienteDto extends PartialType(ClienteManualDto, { skipNullProperties: false }) {
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsBoolean() ativo?: boolean;
}

export class ConsultaClientesDto {
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsISO8601({ strict: true }) criado_desde?: string;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsISO8601({ strict: true }) criado_ate?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) pagina = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
  @Transform(aparar) @IsString() @MaxLength(200) busca = '';
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsUUID('4') imovel_id?: string;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsIn(['true', 'false']) ativo?: string;
}
