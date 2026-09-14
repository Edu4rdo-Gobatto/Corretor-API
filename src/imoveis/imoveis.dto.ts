import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { StatusImovel } from './imovel.entity';

const texto = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const decimal = ({ value }: { value: unknown }) => typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
const definido = (_objeto: unknown, valor: unknown) => valor !== undefined;

export class CaracteristicaImovelDto {
  @IsUUID('4') caracteristica_id!: string;
  @IsOptional() @IsString() @MaxLength(500) valor?: string | null;
}

export class CriarImovelDto {
  @Transform(texto) @IsString() @Length(3, 200) titulo!: string;
  @IsUUID('4') tipo_id!: string;
  @IsUUID('4') finalidade_id!: string;
  @Transform(decimal) @IsString() @Matches(/^\d{1,10}(\.\d{1,2})?$/) valor!: string;
  @IsOptional() @Transform(decimal) @IsString() @Matches(/^\d{1,8}(\.\d{1,2})?$/) valor_condominio?: string | null;
  @IsOptional() @Transform(decimal) @IsString() @Matches(/^\d{1,8}(\.\d{1,2})?$/) valor_iptu?: string | null;
  @Transform(decimal) @IsString() @Matches(/^\d{1,8}(\.\d{1,2})?$/) area_util!: string;
  @Transform(decimal) @IsString() @Matches(/^\d{1,8}(\.\d{1,2})?$/) area_total!: string;
  @IsOptional() @Matches(/^\d{5}-?\d{3}$/) cep?: string | null;
  @Transform(texto) @IsString() @Length(1, 200) logradouro!: string;
  @Transform(texto) @IsString() @Length(1, 30) numero!: string;
  @IsOptional() @Transform(texto) @IsString() @MaxLength(200) complemento?: string | null;
  @Transform(texto) @IsString() @Length(1, 100) bairro!: string;
  @Transform(texto) @IsString() @Length(1, 100) cidade!: string;
  @IsIn(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']) estado!: string;
  @Transform(texto) @IsString() @Length(1, 20000) descricao!: string;
  @ValidateIf(definido) @IsEnum(StatusImovel) status?: StatusImovel;
  @ValidateIf(definido) @IsUUID('4') corretor_id?: string;
  @ValidateIf(definido) @IsBoolean() ativo?: boolean;
  @ValidateIf(definido) @IsArray() @ArrayMaxSize(100)
  @ArrayUnique((item: CaracteristicaImovelDto) => item.caracteristica_id)
  @ValidateNested({ each: true }) @Type(() => CaracteristicaImovelDto) caracteristicas?: CaracteristicaImovelDto[];
}

export class AtualizarImovelDto extends PartialType(CriarImovelDto, { skipNullProperties: false }) {}

export class ConsultaImoveisDto {
  @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
  @IsOptional() @IsUUID('4') tipo_id?: string;
  @IsOptional() @IsUUID('4') finalidade_id?: string;
  @IsOptional() @Transform(texto) @IsString() @Length(1, 100) cidade?: string;
  @IsOptional() @Transform(texto) @IsString() @Length(1, 200) busca?: string;
  @IsOptional() @Transform(decimal) @IsString() @Matches(/^\d{1,10}(\.\d{1,2})?$/) valor_min?: string;
  @IsOptional() @Transform(decimal) @IsString() @Matches(/^\d{1,10}(\.\d{1,2})?$/) valor_max?: string;
}

export class ConsultaInternaImoveisDto extends ConsultaImoveisDto {
  @IsOptional() @IsEnum(StatusImovel) status?: StatusImovel;
  @IsOptional() @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean() ativo?: boolean;
  @IsOptional() @IsUUID('4') corretor_id?: string;
}
