import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class OrigemGuard implements CanActivate {
  constructor(private readonly configuracao: ConfigService) {}
  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToHttp().getRequest<Request>();
    const origem = requisicao.get('origin');
    const contexto_origem = requisicao.get('sec-fetch-site');
    const permitidas = this.configuracao.get<string>('ALLOWED_ORIGINS', '').split(',').map(valor => valor.trim()).filter(Boolean);
    if ((origem && !permitidas.includes(origem)) || (!origem && contexto_origem && !['same-origin', 'none'].includes(contexto_origem))) {
      throw new ForbiddenException('Origem não autorizada.');
    }
    return true;
  }
}
