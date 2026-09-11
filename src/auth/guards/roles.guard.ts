import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgentRole } from '../../agents/agent.entity';
import { AgentProfile } from '../../agents/dto/agent-profile.dto';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AgentRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: AgentProfile }>();
    return !!user && roles.includes(user.role);
  }
}
