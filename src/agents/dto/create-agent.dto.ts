import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from 'class-validator';
import { AgentRole } from '../agent.entity';

export class CreateAgentDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 100)
  name!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(12, 128)
  @Matches(/\S/)
  password!: string;

  @Matches(/^[1-9]\d{9,14}$/)
  whatsappNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  creci?: string | null;

  @IsEnum(AgentRole)
  role: AgentRole = AgentRole.AGENT;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
