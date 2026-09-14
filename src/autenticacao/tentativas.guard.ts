import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request } from 'express';

@Injectable()
export class TentativasGuard implements CanActivate {
  private readonly tentativas = new Map<string, { quantidade: number; expira_em: number }>();
  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToHttp().getRequest<Request>();
    const agora = Date.now();
    for (const [chave, tentativa] of this.tentativas) if (tentativa.expira_em <= agora) this.tentativas.delete(chave);
    const email: unknown = (requisicao.body as { email?: unknown } | undefined)?.email;
    const conta = typeof email === 'string' ? createHash('sha256').update(email.trim().toLowerCase()).digest('hex') : 'invalida';
    const chaves = [
      { chave: `ip:${requisicao.ip ?? requisicao.socket.remoteAddress}`, limite: 50 },
      { chave: `conta:${conta}`, limite: 10 },
    ];
    if (chaves.some(({ chave, limite }) => (this.tentativas.get(chave)?.quantidade ?? 0) >= limite) || this.tentativas.size >= 10000) {
      contexto.switchToHttp().getResponse<{ setHeader: (nome: string, valor: string) => void }>().setHeader('Retry-After', '900');
      throw new HttpException('Muitas tentativas. Tente novamente em 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    for (const { chave } of chaves) {
      const tentativa = this.tentativas.get(chave) ?? { quantidade: 0, expira_em: agora + 15 * 60 * 1000 };
      tentativa.quantidade += 1;
      this.tentativas.set(chave, tentativa);
    }
    return true;
  }
}
