import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { SessaoLogin } from './sessao-login.entity';

// A sessão cai após 4h sem requisições; não há limite absoluto enquanto houver uso.
export const INATIVIDADE_SESSAO_MS = 4 * 60 * 60 * 1000;
// Evita uma escrita no banco por requisição: a atividade só é gravada se a sessão já "envelheceu" este tanto.
const INTERVALO_ATIVIDADE_MS = 5 * 60 * 1000;

@Injectable()
export class SessoesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessoesService.name);
  private temporizador?: ReturnType<typeof setInterval>;
  constructor(@InjectRepository(SessaoLogin) private readonly sessoes: Repository<SessaoLogin>) {}

  onModuleInit(): void {
    // GAP-11: expurgar sessões expiradas no boot da API.
    void this.limparExpiradas().catch(() => this.logger.error('Falha na limpeza inicial de sessões expiradas.'));
    this.temporizador = setInterval(() => {
      void this.limparExpiradas().catch(() => this.logger.error('Falha na limpeza de sessões expiradas; nova tentativa na próxima hora.'));
    }, 60 * 60 * 1000);
    this.temporizador.unref();
  }

  onModuleDestroy(): void { if (this.temporizador) clearInterval(this.temporizador); }

  async criar(corretor_id: number): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    await this.sessoes.save(this.sessoes.create({ token_hash: this.hash(token), corretor_id,
      expira_em: new Date(Date.now() + INATIVIDADE_SESSAO_MS), criado_por: corretor_id, alterado_por: corretor_id }));
    return token;
  }

  /**
   * Estende a sessão sem trocar o token. Idempotente: um F5 que aborta a resposta não invalida o cookie do navegador,
   * o que acontecia com a rotação de uso único.
   */
  async renovar(token: string): Promise<number> {
    if (!/^[A-Za-z0-9_-]{64}$/.test(token)) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    const resultado = await this.sessoes.createQueryBuilder().update().set({ expira_em: new Date(Date.now() + INATIVIDADE_SESSAO_MS) })
      .where('token_hash = :hash AND expira_em > :agora', { hash: this.hash(token), agora: new Date() }).returning(['corretor_id']).execute();
    const linhas: unknown = resultado.raw;
    const renovada: unknown = Array.isArray(linhas) ? linhas[0] : undefined;
    if (typeof renovada !== 'object' || renovada === null || !('corretor_id' in renovada) || !Number.isInteger(Number(renovada.corretor_id)) || Number(renovada.corretor_id) < 1) {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
    return Number(renovada.corretor_id);
  }

  /** Reinicia a contagem de inatividade a partir da requisição atual; no máximo uma escrita a cada 5 min por sessão. */
  async registrarAtividade(token: string, corretor_id: number): Promise<void> {
    if (!/^[A-Za-z0-9_-]{64}$/.test(token)) return;
    const nova_expiracao = new Date(Date.now() + INATIVIDADE_SESSAO_MS);
    await this.sessoes.createQueryBuilder().update().set({ expira_em: nova_expiracao })
      .where('token_hash = :hash AND corretor_id = :corretor_id AND expira_em > :agora AND expira_em < :limite', {
        hash: this.hash(token), corretor_id, agora: new Date(), limite: new Date(nova_expiracao.getTime() - INTERVALO_ATIVIDADE_MS),
      }).execute()
      .catch(() => this.logger.error('Falha ao registrar atividade da sessão.'));
  }

  async revogar(token: string): Promise<void> { await this.sessoes.delete({ token_hash: this.hash(token) }); }

  async revogarTodasDoCorretor(corretor_id: number): Promise<void> {
    await this.sessoes.createQueryBuilder().delete().where('corretor_id = :corretor_id', { corretor_id }).execute();
  }

  async limparExpiradas(): Promise<number> {
    const resultado = await this.sessoes.createQueryBuilder().delete().where('expira_em <= :agora', { agora: new Date() }).execute();
    return resultado.affected ?? 0;
  }

  private hash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
}
