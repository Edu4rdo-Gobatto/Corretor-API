import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';

export const Cargos = (...cargos: UsuarioAutenticado['cargo'][]) => SetMetadata('cargos_permitidos', cargos);

@Injectable()
export class CargosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(contexto: ExecutionContext): boolean {
    const cargos = this.reflector.getAllAndOverride<UsuarioAutenticado['cargo'][]>('cargos_permitidos', [contexto.getHandler(), contexto.getClass()]);
    if (!cargos?.length) return true;
    const usuario = contexto.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>().user;
    if (!usuario || !cargos.includes(usuario.cargo)) throw new ForbiddenException('Permissão insuficiente.');
    return true;
  }
}
