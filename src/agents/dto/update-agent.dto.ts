import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, ValidateIf } from 'class-validator';
import { CreateAgentDto } from './create-agent.dto';
import { AgentRole } from '../agent.entity';

export class UpdateAgentDto extends PartialType(CreateAgentDto, { skipNullProperties: false }) {
  // Suppress the create DTO default: a partial update must not demote an ADMIN.
  override role: AgentRole | undefined = undefined;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
