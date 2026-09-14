import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class LimiteClientesGuard implements CanActivate {
  private readonly tentativas = new Map<string, { quantidade: number; expira: number }>();
  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToHttp().getRequest<Request>();
    const agora = Date.now();
    for (const [ip, estado] of this.tentativas) if (estado.expira <= agora) this.tentativas.delete(ip);
    const ip = requisicao.ip || requisicao.socket.remoteAddress || 'desconhecido';
    let estado = this.tentativas.get(ip);
    if (!estado) {
      if (this.tentativas.size >= 10000) throw new HttpException('Tente novamente em instantes.', 429);
      estado = { quantidade: 0, expira: agora + 60000 };
      this.tentativas.set(ip, estado);
    }
    if (++estado.quantidade > 5) throw new HttpException('Aguarde um minuto antes de tentar novamente.', 429);
    return true;
  }
}
