import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateLeadDto {
  @IsUUID('4')
  propertyId!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 120)
  leadName!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(8, 20)
  @Matches(/^\+?[0-9 ()-]+$/)
  leadPhone!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional()
  @IsEmail()
  @Length(3, 254)
  leadEmail?: string | null;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  message?: string | null;

  @IsBoolean()
  @Equals(true)
  consentGiven!: boolean;
}
