import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from 'class-validator';

// Self-service profile: whitelisted fields only. Email, role, password and
// active stay out on purpose — email/role/active via ADMIN in /agents,
// password via PATCH /auth/me/password.
export class UpdateProfileDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  name!: string;

  @Matches(/^[1-9]\d{9,14}$/)
  whatsappNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  creci?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
