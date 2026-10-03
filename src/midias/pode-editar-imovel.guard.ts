import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Imovel } from '../imoveis/imovel.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';

@Injectable()
export class PodeEditarImovelGuard implements CanActivate {
  constructor(@InjectRepository(Imovel) private readonly imoveis: Repository<Imovel>) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<Request & { user?: UsuarioAutenticado }>();
    const imovel_id = Number(requisicao.params.imovel_id);
    if (!Number.isInteger(imovel_id) || imovel_id < 1) throw new NotFoundException('Imóvel não encontrado.');

    const imovel = await this.imoveis.findOneBy({ id: imovel_id });
    if (!imovel) throw new NotFoundException('Imóvel não encontrado.');

    const usuario = requisicao.user;
    if (!usuario) throw new ForbiddenException('Acesso negado.');

    if (usuario.cargo !== 'ADMIN' && imovel.corretor_id !== usuario.id) {
      throw new ForbiddenException('Somente o corretor responsável ou ADMIN pode alterar as mídias.');
    }

    return true;
  }
}

