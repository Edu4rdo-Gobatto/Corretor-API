import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class CommissionDto {
  @IsUUID('4') leaseId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) installmentCount!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) firstDueDate!: string;
  @Transform(trim) @IsString() @MaxLength(5000) notes = '';
}
export class CommissionQueryDto { @IsOptional() @IsUUID('4') leaseId?: string; @IsOptional() @IsIn(['PENDING','PAID']) status?: string; }
export class MarkCommissionPaidDto { @Transform(trim) @IsString() @MaxLength(1000) paymentNote = ''; }
