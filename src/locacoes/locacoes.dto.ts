import { PartialType, PickType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IdRegistro, aparar, booleano, definido } from '../comum/dto';
import { DataCivilValida } from '../comum/validacao';

export class ConsultaLocacoesDto {
  @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(200) busca?: string;
  @IsOptional() @Transform(booleano) @IsBoolean() ativo?: boolean;
}
export class ConsultaContratosDto extends ConsultaLocacoesDto {
  @IsOptional() @IsIn(['ATIVO', 'INATIVO']) status?: 'ATIVO' | 'INATIVO';
  @IsOptional() @IdRegistro() imovel_id?: number;
  @IsOptional() @IdRegistro() corretor_id?: number;
  @IsOptional() @IdRegistro() pessoa_id?: number;
}
export class CriarContratoDto {
  @Transform(aparar) @IsString() @Length(3, 100) @Matches(/^[\p{L}\p{N}._-]+$/u) numero_contrato!: string;
  @IdRegistro() imovel_id!: number;
  @IdRegistro() locador_id!: number;
  @IdRegistro() locatario_id!: number;
  @IdRegistro() corretor_id!: number;
  @DataCivilValida() data_inicio!: string;
  @DataCivilValida() data_fim!: string;
  @Matches(/^(?:0|[1-9]\d{0,9})\.\d{2}$/) valor_aluguel!: string;
  @IsInt() @Min(1) @Max(31) dia_vencimento!: number;
  @Matches(/^(?:(?:0|[1-9]\d?)\.\d{2}|100\.00)$/) taxa_administracao!: string;
  @Transform(aparar) @IsString() @Length(2, 1000) garantia_locaticia!: string;
  /** Cadastros ativos; o nome do índice também passa a ser o texto `indice_reajuste`. */
  @IdRegistro() tipo_contrato_id!: number;
  @IdRegistro() indice_reajuste_id!: number;
  @Transform(aparar) @IsString() @Length(2, 1000) cobranca_iptu_condominio!: string;
  @ValidateIf(definido) @IsIn(['ATIVO', 'INATIVO']) status?: 'ATIVO' | 'INATIVO';
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(10000) observacoes?: string | null;
}
export class EncerrarContratoDto {
  /** Último dia de vigência; precisa ficar antes do fim contratado. */
  @DataCivilValida() data_encerramento!: string;
  @Transform(aparar) @IsString() @Length(2, 1000) motivo!: string;
}
/** Partes, imóvel e intermediador vêm do contrato renovado; o restante pode mudar (reajuste, nova garantia etc.). */
export class RenovarContratoDto extends PartialType(PickType(CriarContratoDto, ['valor_aluguel', 'dia_vencimento', 'taxa_administracao', 'garantia_locaticia',
  'tipo_contrato_id', 'indice_reajuste_id', 'cobranca_iptu_condominio', 'observacoes'] as const)) {
  @Transform(aparar) @IsString() @Length(3, 100) @Matches(/^[\p{L}\p{N}._-]+$/u) numero_contrato!: string;
  @DataCivilValida() data_inicio!: string;
  @DataCivilValida() data_fim!: string;
}
export class AlterarContratoDto extends PartialType(CriarContratoDto, { skipNullProperties: false }) {
  @ValidateIf(definido) @IsBoolean() ativo?: boolean;
}
