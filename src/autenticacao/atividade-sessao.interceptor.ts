import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { lerCookieSessao } from './cookie-sessao';
import { SessoesService } from './sessoes.service';

/** Roda após os guards: toda requisição autenticada reinicia a contagem de inatividade da sessão. */
@Injectable()
export class AtividadeSessaoInterceptor implements NestInterceptor {
  constructor(private readonly sessoes: SessoesService) {}
  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    if (contexto.getType() === 'http') {
      const requisicao = contexto.switchToHttp().getRequest<Request & { user?: UsuarioAutenticado }>();
      const token = requisicao.user ? lerCookieSessao(requisicao) : '';
      if (requisicao.user && token) void this.sessoes.registrarAtividade(token, requisicao.user.id);
    }
    return proximo.handle();
  }
}
