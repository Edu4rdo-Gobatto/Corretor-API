import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { DataCivilValida, DocumentoValido, TelefoneValido } from '../comum/validacao';
import type { PapelParteLocacao } from './parte-locacao.entity';

const aparar = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;
const booleano = ({ value }: { value: unknown }): unknown => value === 'true' ? true : value === 'false' ? false : value;

export class ConsultaLocacoesDto {
  @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(200) busca?: string;
  @IsOptional() @Transform(booleano) @IsBoolean() ativo?: boolean;
}
export class ConsultaPartesDto extends ConsultaLocacoesDto {
  @IsOptional() @IsIn(['LOCADOR', 'LOCATARIO']) papel?: PapelParteLocacao;
  @IsOptional() @Matches(/^\d{1,14}$/) cpf_cnpj?: string;
}
export class CriarParteLocacaoDto {
  @IsIn(['LOCADOR', 'LOCATARIO']) papel!: PapelParteLocacao;
  @IsIn(['PF', 'PJ']) tipo_pessoa!: 'PF' | 'PJ';
  @Transform(aparar) @IsString() @Length(2, 200) nome!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.replace(/[.\-/ ]/g, '') : value)
  @DocumentoValido() cpf_cnpj!: string;
  @IsOptional() @Transform(aparar) @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @TelefoneValido() telefone?: string | null;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(1000) endereco?: string | null;
  @IsOptional() @DataCivilValida() data_nascimento?: string | null;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(150) banco_nome?: string | null;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(40) banco_agencia?: string | null;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(80) banco_conta?: string | null;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(254) chave_pix?: string | null;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(10000) observacoes?: string | null;
}
export class AlterarParteLocacaoDto extends PartialType(CriarParteLocacaoDto, { skipNullProperties: false }) {
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsBoolean() ativo?: boolean;
}
export class ConsultaContratosDto extends ConsultaLocacoesDto {
  @IsOptional() @IsIn(['ATIVO', 'INATIVO']) status?: 'ATIVO' | 'INATIVO';
  @IsOptional() @IsUUID() imovel_id?: string;
  @IsOptional() @IsUUID() corretor_id?: string;
}
export class CriarContratoDto {
  @Transform(aparar) @IsString() @Length(3, 100) @Matches(/^[\p{L}\p{N}._-]+$/u) numero_contrato!: string;
  @IsUUID() imovel_id!: string;
  @IsUUID() locador_id!: string;
  @IsUUID() locatario_id!: string;
  @IsUUID() corretor_id!: string;
  @DataCivilValida() data_inicio!: string;
  @DataCivilValida() data_fim!: string;
  @Matches(/^(?:0|[1-9]\d{0,9})\.\d{2}$/) valor_aluguel!: string;
  @IsInt() @Min(1) @Max(31) dia_vencimento!: number;
  @Matches(/^(?:(?:0|[1-9]\d?)\.\d{2}|100\.00)$/) taxa_administracao!: string;
  @Transform(aparar) @IsString() @Length(2, 1000) garantia_locaticia!: string;
  @Transform(aparar) @IsString() @Length(2, 150) indice_reajuste!: string;
  @Transform(aparar) @IsString() @Length(2, 1000) cobranca_iptu_condominio!: string;
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsIn(['ATIVO', 'INATIVO']) status?: 'ATIVO' | 'INATIVO';
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(10000) observacoes?: string | null;
}
export class AlterarContratoDto extends PartialType(CriarContratoDto, { skipNullProperties: false }) {
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsBoolean() ativo?: boolean;
}
