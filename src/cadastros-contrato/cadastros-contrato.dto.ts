import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { aparar, definido } from '../comum/dto';

/** Texto opcional: vazio vira null para limpar o campo. */
const opcional = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() || null : value;

export class CriarIndiceReajusteDto {
  @Transform(aparar) @IsString() @Length(2, 100) nome!: string;
  @IsInt() @Min(1) @Max(600) periodicidade_meses!: number;
  @IsOptional() @Transform(opcional) @IsString() @MaxLength(2000) regra?: string | null;
  @ValidateIf(definido) @IsBoolean() ativo?: boolean;
}
export class AtualizarIndiceReajusteDto extends PartialType(CriarIndiceReajusteDto, { skipNullProperties: false }) {}

export class CriarTipoContratoDto {
  @Transform(aparar) @IsString() @Length(2, 100) nome!: string;
  @IsOptional() @Transform(opcional) @IsString() @MaxLength(1000) descricao?: string | null;
  @ValidateIf(definido) @IsBoolean() ativo?: boolean;
}
export class AtualizarTipoContratoDto extends PartialType(CriarTipoContratoDto, { skipNullProperties: false }) {}
