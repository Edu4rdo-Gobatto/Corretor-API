import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IdRegistro, aparar } from '../comum/dto';
import { DataCivilValida } from '../comum/validacao';
import { ConsultaLocacoesDto } from '../locacoes/locacoes.dto';

export class ConsultaComissoesDto extends ConsultaLocacoesDto {
  @IsOptional() @IdRegistro() imovel_id?: number;
  @IsOptional() @IdRegistro() pessoa_id?: number;
  @IsOptional() @IdRegistro() contrato_id?: number;
  @IsOptional() @IsIn(['LOCACAO', 'VENDA']) tipo_operacao?: 'LOCACAO' | 'VENDA';
}
/** Clientes que o POST aceitaria para o imóvel: ativos, mesmo corretor e sem vínculo com outro imóvel. */
export class ConsultaPessoasElegiveisDto {
  @IdRegistro() imovel_id!: number;
  @IsOptional() @Transform(aparar) @IsString() @MaxLength(200) busca?: string;
  @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 10;
  /** Revalida uma pessoa já escolhida antes do registro. */
  @IsOptional() @IdRegistro() pessoa_id?: number;
}
export class CriarComissaoDto {
  @IsIn(['LOCACAO', 'VENDA']) tipo_operacao!: 'LOCACAO' | 'VENDA';
  @IsOptional() @IdRegistro() contrato_id?: number | null;
  @IdRegistro() imovel_id!: number;
  @IdRegistro() pessoa_id!: number;
  @Matches(/^(?:0|[1-9]\d{0,9})\.\d{2}$/) valor_total!: string;
  @IsInt() @Min(1) @Max(600) quantidade_parcelas!: number;
  @DataCivilValida() primeiro_vencimento!: string;
  @IsOptional() @IsString() @MaxLength(10000) observacoes?: string | null;
}
export class AlterarComissaoDto {
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined) @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() @MaxLength(10000) observacoes?: string | null;
}
export class PagarParcelaDto {
  @IsIn([true]) confirmar_pagamento!: true;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(5, 2000) observacao_pagamento!: string;
}
