import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class PartyDto {
  @IsIn(['OWNER', 'TENANT']) kind!: 'OWNER' | 'TENANT';
  @IsIn(['PF', 'PJ']) personType!: 'PF' | 'PJ';
  @Transform(trim) @IsString() @Length(2, 200) name!: string;
  @IsString() @Matches(/^\d{11}(\d{3})?$/) taxId!: string;
  @Transform(trim) @IsString() @MaxLength(254) @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/) email = '';
  @Transform(trim) @IsString() @MaxLength(40) phone = '';
  @Transform(trim) @IsString() @MaxLength(1000) address = '';
  @IsString() @MaxLength(10) birthDate = '';
  @Transform(trim) @IsString() @MaxLength(5000) notes = '';
  @Transform(trim) @IsString() @MaxLength(100) bankName = '';
  @Transform(trim) @IsString() @MaxLength(30) bankAgency = '';
  @Transform(trim) @IsString() @MaxLength(50) bankAccount = '';
  @Transform(trim) @IsString() @MaxLength(254) pixKey = '';
  @IsBoolean() active = true;
}
export class PageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @Transform(trim) @IsString() @MaxLength(200) search = '';
}
export class PartyQuery extends PageQuery {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsIn(['OWNER', 'TENANT']) kind?: 'OWNER' | 'TENANT';
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsIn(['true', 'false']) active?: string;
}
export class LeaseDto {
  @Transform(trim) @IsString() @Length(1, 100) reference!: string;
  @IsUUID('4') propertyId!: string;
  @IsUUID('4') ownerId!: string;
  @IsUUID('4') tenantId!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string;
  @IsString() @Matches(/^(0|[1-9]\d{0,9})\.\d{2}$/) rentAmount!: string;
  @IsInt() @Min(1) @Max(31) dueDay!: number;
  @IsIn(['DRAFT', 'ACTIVE', 'ENDED']) status!: 'DRAFT' | 'ACTIVE' | 'ENDED';
  @Transform(trim) @IsString() @MaxLength(5000) notes = '';
}
export class LeaseQuery extends PageQuery {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID('4') partyId?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsIn(['DRAFT', 'ACTIVE', 'ENDED']) status?: 'DRAFT' | 'ACTIVE' | 'ENDED';
}
export class DocumentTargetDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID('4') partyId?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID('4') leaseId?: string;
}
