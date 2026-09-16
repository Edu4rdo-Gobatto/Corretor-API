import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { SessaoLogin } from './sessao-login.entity';

export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessoesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessoesService.name);
  private temporizador?: ReturnType<typeof setInterval>;
  constructor(@InjectRepository(SessaoLogin) private readonly sessoes: Repository<SessaoLogin>) {}

  onModuleInit(): void {
    this.temporizador = setInterval(() => {
      void this.limparExpiradas().catch(() => this.logger.error('Falha na limpeza de sessões expiradas; nova tentativa na próxima hora.'));
    }, 60 * 60 * 1000);
    this.temporizador.unref();
  }

  onModuleDestroy(): void { if (this.temporizador) clearInterval(this.temporizador); }

  async criar(corretor_id: string): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    await this.sessoes.save(this.sessoes.create({ token_hash: this.hash(token), corretor_id,
      expira_em: new Date(Date.now() + DURACAO_SESSAO_MS), criado_por: corretor_id, alterado_por: corretor_id }));
    return token;
  }

  async consumir(token: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{64}$/.test(token)) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    // A mesma instrução remove e devolve o token, garantindo uso único entre instâncias.
    const resultado = await this.sessoes.createQueryBuilder().delete().where('token_hash = :hash', { hash: this.hash(token) })
      .returning(['corretor_id', 'expira_em']).execute();
    const linhas: unknown = resultado.raw;
    const consumida: unknown = Array.isArray(linhas) ? linhas[0] : undefined;
    if (typeof consumida !== 'object' || consumida === null || !('corretor_id' in consumida) || typeof consumida.corretor_id !== 'string'
      || !('expira_em' in consumida) || !(consumida.expira_em instanceof Date || typeof consumida.expira_em === 'string')
      || !(new Date(consumida.expira_em).getTime() > Date.now())) {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
    return consumida.corretor_id;
  }

  async revogar(token: string): Promise<void> { await this.sessoes.delete({ token_hash: this.hash(token) }); }

  async revogarTodasDoCorretor(corretor_id: string): Promise<void> {
    await this.sessoes.createQueryBuilder().delete().where('corretor_id = :corretor_id', { corretor_id }).execute();
  }

  async limparExpiradas(): Promise<number> {
    const resultado = await this.sessoes.createQueryBuilder().delete().where('expira_em <= :agora', { agora: new Date() }).execute();
    return resultado.affected ?? 0;
  }

  private hash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
}
