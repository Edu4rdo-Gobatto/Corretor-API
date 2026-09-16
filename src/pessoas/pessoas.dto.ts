import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsEnum, IsIn, IsISO8601, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IdRegistro, aparar, booleano, definido, informado } from '../comum/dto';
import { DataCivilValida, DocumentoValido, TelefoneValido } from '../comum/validacao';
import { StatusContato, type TipoPessoa } from './pessoa.entity';

const minusculo = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
const somenteDigitos = ({ value }: { value: unknown }) => typeof value === 'string' ? value.replace(/[.\-/ ]/g, '') : value;

class ContatoDto {
  @Transform(aparar) @IsString() @Length(2, 200) nome!: string;
  @Transform(aparar) @TelefoneValido() telefone!: string;
  @ValidateIf(informado) @Transform(minusculo) @IsEmail() @MaxLength(254) email?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(5000) mensagem?: string | null;
}

/** Contato vindo do site: só os campos do formulário e o consentimento obrigatório. */
export class PessoaPublicaDto extends ContatoDto {
  @IdRegistro() imovel_id!: number;
  @IsBoolean() @Equals(true) consentimento!: true;
}

export class CriarPessoaDto extends ContatoDto {
  @ValidateIf(informado) @IsIn(['PF', 'PJ']) tipo_pessoa?: TipoPessoa | null;
  @ValidateIf(informado) @Transform(somenteDigitos) @DocumentoValido() cpf_cnpj?: string | null;
  @ValidateIf(informado) @DataCivilValida() data_nascimento?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(1000) endereco?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(150) banco_nome?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(40) banco_agencia?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(80) banco_conta?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(254) chave_pix?: string | null;
  @ValidateIf(informado) @Transform(aparar) @IsString() @MaxLength(10000) observacoes?: string | null;
  @ValidateIf(informado) @IdRegistro() imovel_id?: number | null;
  @ValidateIf(definido) @IdRegistro() corretor_id?: number;
  @ValidateIf(definido) @IsEnum(StatusContato) status_contato?: StatusContato;
}

export class AtualizarPessoaDto extends PartialType(CriarPessoaDto, { skipNullProperties: false }) {
  @ValidateIf(definido) @IsBoolean() ativo?: boolean;
}

export class ConsultaPessoasDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) pagina = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(200) busca?: string;
  @IsOptional() @IsEnum(StatusContato) status_contato?: StatusContato;
  @IsOptional() @IdRegistro() imovel_id?: number;
  @IsOptional() @IdRegistro() corretor_id?: number;
  @IsOptional() @IdRegistro() id?: number;
  @IsOptional() @Transform(booleano) @IsBoolean() ativo?: boolean;
  @IsOptional() @IsISO8601({ strict: true }) criado_desde?: string;
  @IsOptional() @IsISO8601({ strict: true }) criado_ate?: string;
}
