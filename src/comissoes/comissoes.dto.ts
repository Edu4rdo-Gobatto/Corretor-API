import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { DataCivilValida } from '../comum/validacao';
import { ConsultaLocacoesDto } from '../locacoes/locacoes.dto';

export class ConsultaComissoesDto extends ConsultaLocacoesDto {
  @IsOptional() @IsUUID() imovel_id?: string;
  @IsOptional() @IsUUID() cliente_id?: string;
  @IsOptional() @IsUUID() contrato_id?: string;
  @IsOptional() @IsIn(['LOCACAO', 'VENDA']) tipo_operacao?: 'LOCACAO' | 'VENDA';
}
export class CriarComissaoDto {
  @IsIn(['LOCACAO', 'VENDA']) tipo_operacao!: 'LOCACAO' | 'VENDA';
  @IsOptional() @IsUUID() contrato_id?: string | null;
  @IsUUID() imovel_id!: string;
  @IsUUID() cliente_id!: string;
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
