import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CriarCadastroDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(2, 100) nome!: string;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined)
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug?: string;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsBoolean() ativo?: boolean;
}
export class AtualizarCadastroDto extends PartialType(CriarCadastroDto, { skipNullProperties: false }) {}

export class CriarCaracteristicaDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(2, 100) nome!: string;
  @IsOptional() @IsString() @MaxLength(100) icone?: string | null;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsBoolean() ativo?: boolean;
}
export class AtualizarCaracteristicaDto extends PartialType(CriarCaracteristicaDto, { skipNullProperties: false }) {}

export class ConsultaCadastrosDto {
  @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 100;
  @IsOptional() @IsString() @MaxLength(100) busca?: string;
}
