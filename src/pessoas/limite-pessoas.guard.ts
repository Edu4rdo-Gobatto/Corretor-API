import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Request } from 'express';

/** Cinco contatos por minuto por IP no formulário público; memória do processo, suficiente para uma instância. */
@Injectable()
export class LimitePessoasGuard implements CanActivate {
  private readonly tentativas = new Map<string, { quantidade: number; expira: number }>();
  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToHttp().getRequest<Request>();
    const agora = Date.now();
    for (const [ip, estado] of this.tentativas) if (estado.expira <= agora) this.tentativas.delete(ip);
    const ip = requisicao.ip || requisicao.socket.remoteAddress || 'desconhecido';
    let estado = this.tentativas.get(ip);
    if (!estado) {
      // Cheio, descarta o IP mais antigo (ordem de inserção) em vez de recusar todo visitante novo.
      if (this.tentativas.size >= 10000) this.tentativas.delete(this.tentativas.keys().next().value!);
      estado = { quantidade: 0, expira: agora + 60000 };
      this.tentativas.set(ip, estado);
    }
    if (++estado.quantidade > 5) throw new HttpException('Aguarde um minuto antes de tentar novamente.', 429);
    return true;
  }
}
