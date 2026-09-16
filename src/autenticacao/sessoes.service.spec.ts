import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { SessaoLogin } from './sessao-login.entity';
import { SessoesService } from './sessoes.service';

class RepositorioSessoes {
  readonly registros = new Map<string, SessaoLogin>();
  create(dados: Partial<SessaoLogin>): SessaoLogin { return Object.assign(new SessaoLogin(), dados); }
  save(sessao: SessaoLogin): Promise<SessaoLogin> { this.registros.set(sessao.token_hash, sessao); return Promise.resolve(sessao); }
  delete(filtro: { token_hash: string }): Promise<{ affected: number }> { return Promise.resolve({ affected: this.registros.delete(filtro.token_hash) ? 1 : 0 }); }
  createQueryBuilder() {
    let hash: string | undefined;
    let expiradas = false;
    let retornando = false;
    const consulta = {
      delete: () => consulta,
      where: (sql: string, parametros: { hash?: string; agora?: Date; corretor_id?: string }) => { hash = parametros.hash; expiradas = sql.includes('expira_em <='); if (parametros.corretor_id) { for (const [chave, sessao] of this.registros) if (sessao.corretor_id === parametros.corretor_id) this.registros.delete(chave); } return consulta; },
      returning: () => { retornando = true; return consulta; },
      execute: () => {
        const encontradas = [...this.registros.values()].filter(sessao => expiradas ? sessao.expira_em.getTime() <= Date.now() : sessao.token_hash === hash);
        for (const sessao of encontradas) this.registros.delete(sessao.token_hash);
        return Promise.resolve({ affected: encontradas.length, raw: retornando ? encontradas : [] });
      },
    };
    return consulta;
  }
}

describe('sessões rotativas', () => {
  let repositorio: RepositorioSessoes;
  let servico: SessoesService;
  beforeEach(() => { repositorio = new RepositorioSessoes(); servico = new SessoesService(repositorio as unknown as Repository<SessaoLogin>); });
  afterEach(() => { servico.onModuleDestroy(); jest.useRealTimers(); });

  it('persiste só SHA-256 com validade de 30 dias e autoria', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-13T12:00:00Z'));
    const token = await servico.criar('corretor-1');
    const sessao = [...repositorio.registros.values()][0];
    expect(token).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(sessao.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(sessao.expira_em.toISOString()).toBe('2026-10-13T12:00:00.000Z');
    expect(sessao.criado_por).toBe('corretor-1');
    expect(JSON.stringify(sessao)).not.toContain(token);
  });
  it('consome o token uma única vez em chamadas concorrentes', async () => {
    const token = await servico.criar('corretor-1');
    const resultados = await Promise.allSettled([servico.consumir(token), servico.consumir(token)]);
    expect(resultados.filter(r => r.status === 'fulfilled')).toEqual([{ status: 'fulfilled', value: 'corretor-1' }]);
    expect(repositorio.registros.size).toBe(0);
  });
  it('rejeita token expirado ou malformado', async () => {
    const token = await servico.criar('corretor-1');
    [...repositorio.registros.values()][0].expira_em = new Date(0);
    await expect(servico.consumir(token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(servico.consumir('invalido')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('revoga apenas a sessão apresentada', async () => {
    const token = await servico.criar('corretor-1');
    const outro = await servico.criar('corretor-1');
    await servico.revogar(token);
    await expect(servico.consumir(token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(servico.consumir(outro)).resolves.toBe('corretor-1');
  });
  it('revoga todas as sessões de um corretor', async () => {
    const primeira = await servico.criar('corretor-1');
    const segunda = await servico.criar('corretor-1');
    await servico.criar('outro-corretor');
    await servico.revogarTodasDoCorretor('corretor-1');
    await expect(servico.consumir(primeira)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(servico.consumir(segunda)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repositorio.registros.size).toBe(1);
    expect([...repositorio.registros.values()][0].corretor_id).toBe('outro-corretor');
  });
  it('remove sessões expiradas automaticamente a cada hora e encerra timer ao desligar', async () => {
    jest.useFakeTimers();
    await servico.criar('expirado');
    [...repositorio.registros.values()][0].expira_em = new Date(0);
    await servico.criar('valido');
    servico.onModuleInit();
    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect([...repositorio.registros.values()].map(s => s.corretor_id)).toEqual(['valido']);
    servico.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
