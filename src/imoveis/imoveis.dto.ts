import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { IdRegistro, aparar, booleano, decimal, definido, informado } from '../comum/dto';
import { DataCivilValida } from '../comum/validacao';
import { StatusImovel } from './imovel.entity';

const DECIMAL_12 = /^\d{1,10}(\.\d{1,2})?$/;
const DECIMAL_10 = /^\d{1,8}(\.\d{1,2})?$/;
export const ORDENACOES = ['recentes', 'valor_asc', 'valor_desc', 'area_asc', 'area_desc'] as const;
export type Ordenacao = typeof ORDENACOES[number];

export class CaracteristicaImovelDto {
  @IdRegistro() caracteristica_id!: number;
  @IsOptional() @IsString() @MaxLength(500) valor?: string | null;
}

export class CriarImovelDto {
  @Transform(aparar) @IsString() @Length(3, 200) titulo!: string;
  @IdRegistro() tipo_id!: number;
  @IdRegistro() finalidade_id!: number;
  @ValidateIf(informado) @Transform(decimal) @IsString() @Matches(DECIMAL_12) valor_venda?: string | null;
  @ValidateIf(informado) @Transform(decimal) @IsString() @Matches(DECIMAL_12) valor_locacao?: string | null;
  @ValidateIf(informado) @Transform(decimal) @IsString() @Matches(DECIMAL_10) valor_condominio?: string | null;
  @ValidateIf(informado) @Transform(decimal) @IsString() @Matches(DECIMAL_10) valor_iptu?: string | null;
  @Transform(decimal) @IsString() @Matches(DECIMAL_10) area_util!: string;
  @Transform(decimal) @IsString() @Matches(DECIMAL_10) area_total!: string;
  @ValidateIf(informado) @Matches(/^\d{5}-?\d{3}$/) cep?: string | null;
  @Transform(aparar) @IsString() @Length(1, 200) logradouro!: string;
  @Transform(aparar) @IsString() @Length(1, 30) numero!: string;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(200) complemento?: string | null;
  @Transform(aparar) @IsString() @Length(1, 100) bairro!: string;
  @Transform(aparar) @IsString() @Length(1, 100) cidade!: string;
  @IsIn(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']) estado!: string;
  @Transform(aparar) @IsString() @Length(1, 20000) descricao!: string;
  @ValidateIf(definido) @IsEnum(StatusImovel) status?: StatusImovel;
  @ValidateIf(definido) @IsBoolean() destaque?: boolean;
  @ValidateIf(definido) @IdRegistro() corretor_id?: number;
  @ValidateIf(definido) @IsBoolean() ativo?: boolean;
  @ValidateIf(informado) @IdRegistro() proprietario_id?: number | null;
  @ValidateIf(definido) @IsBoolean() exclusividade?: boolean;
  @ValidateIf(informado) @DataCivilValida() exclusividade_ate?: string | null;
  @ValidateIf(informado) @DataCivilValida() data_captacao?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(500) chaves?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(100) matricula?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(100) inscricao_municipal?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(20000) observacoes_internas?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(1000) motivo_baixa?: string | null;
  @ValidateIf(definido) @IsArray() @ArrayMaxSize(100)
  @ArrayUnique((item: CaracteristicaImovelDto) => item.caracteristica_id)
  @ValidateNested({ each: true }) @Type(() => CaracteristicaImovelDto) caracteristicas?: CaracteristicaImovelDto[];
}

export class AtualizarImovelDto extends PartialType(CriarImovelDto, { skipNullProperties: false }) {}

export class ConsultaImoveisDto {
  @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
  @IsOptional() @IdRegistro() tipo_id?: number;
  @IsOptional() @IdRegistro() finalidade_id?: number;
  @IsOptional() @Transform(aparar) @IsString() @Length(1, 100) cidade?: string;
  @IsOptional() @Transform(aparar) @IsString() @Length(1, 100) bairro?: string;
  @IsOptional() @Transform(aparar) @IsString() @Length(1, 200) busca?: string;
  @IsOptional() @Transform(decimal) @IsString() @Matches(DECIMAL_12) valor_min?: string;
  @IsOptional() @Transform(decimal) @IsString() @Matches(DECIMAL_12) valor_max?: string;
  @IsOptional() @Transform(decimal) @IsString() @Matches(DECIMAL_10) area_min?: string;
  @IsOptional() @Transform(decimal) @IsString() @Matches(DECIMAL_10) area_max?: string;
  @IsOptional() @Transform(booleano) @IsBoolean() destaque?: boolean;
  @IsIn(ORDENACOES) ordenar: Ordenacao = 'recentes';
}

export class ConsultaInternaImoveisDto extends ConsultaImoveisDto {
  @IsOptional() @IsEnum(StatusImovel) status?: StatusImovel;
  @IsOptional() @Transform(booleano) @IsBoolean() ativo?: boolean;
  @IsOptional() @IdRegistro() corretor_id?: number;
  @IsOptional() @IdRegistro() proprietario_id?: number;
  @IsOptional() @IdRegistro() id?: number;
}
