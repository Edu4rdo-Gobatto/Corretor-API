import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';
import { PropertyPurpose, PropertyStatus, PropertyType } from '../property.entity';
import { BadRequestException } from '@nestjs/common';

export class CreatePropertyDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(3, 200)
  title!: string;

  @IsEnum(PropertyType)
  type!: PropertyType;

  @IsEnum(PropertyPurpose)
  purpose!: PropertyPurpose;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  price!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  condoFee?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  iptuFee?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  usableArea!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  totalArea!: number;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 200)
  addressStreet!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 30)
  addressNumber!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  addressCity!: string;

  @IsIn(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'])
  addressState!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  neighborhood!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 20000)
  description!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value !== undefined && (typeof value !== 'object' || value === null || JSON.stringify(value).length > 10000)) {
      throw new BadRequestException('features inválido ou excede 10 KB.');
    }
    return value;
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  features?: Record<string, unknown>;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('4')
  agentId?: string;
}
