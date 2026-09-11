import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, IsString, Length, Max, Min } from 'class-validator';

export class LeadQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsUUID('4')
  propertyId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
}
