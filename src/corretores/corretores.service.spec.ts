import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { FindManyOptions, FindOneOptions, FindOperator, FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { CargoCorretor, Corretor } from './corretor.entity';
import { ConsultarCorretoresDto } from './corretores.dto';
import { CorretoresService } from './corretores.service';
import { SenhasService } from './senhas.service';

class RepositorioCorretores {
  readonly registros = new Map<number, Corretor>();
  private sequencia = 0;
  private fila = Promise.resolve();
  readonly manager = {
    transaction: async <T>(executar: (gerente: { query: (sql: string) => Promise<void>; getRepository: () => RepositorioCorretores }) => Promise<T>): Promise<T> => {
      let liberar: (() => void) | undefined;
      const gerente = {
        query: async (sql: string): Promise<void> => {
          if (!sql.includes('pg_advisory_xact_lock')) throw new Error('Consulta de trava desconhecida');
          const anterior = this.fila;
          this.fila = new Promise<void>(resolve => { liberar = resolve; });
          await anterior;
        },
        getRepository: () => this,
      };
      try { return await executar(gerente); } finally { liberar?.(); }
    },
  };
  create(dados: Partial<Corretor>): Corretor { return Object.assign(new Corretor(), { id: ++this.sequencia, criado_em: new Date(), alterado_em: new Date() }, dados); }
  save(corretor: Corretor): Promise<Corretor> {
    if ([...this.registros.values()].some(outro => outro.id !== corretor.id && outro.email === corretor.email)) {
      return Promise.reject(new QueryFailedError('INSERT', [], Object.assign(new Error('E-mail duplicado'), { code: '23505' })));
    }
    this.registros.set(corretor.id, { ...corretor });
    return Promise.resolve({ ...corretor });
  }
  private corresponde(corretor: Corretor, filtros: FindOptionsWhere<Corretor>): boolean {
    return Object.entries(filtros).every(([chave, valor]) => {
      const atual = corretor[chave as keyof Corretor];
      if (valor instanceof FindOperator) return String(atual).toLowerCase().includes(String(valor.value).replace(/^%|%$/g, '').toLowerCase());
      return atual === valor;
    });
  }
  findOneBy(filtros: FindOptionsWhere<Corretor>): Promise<Corretor | null> {
    const registro = [...this.registros.values()].find(corretor => this.corresponde(corretor, filtros));
    return Promise.resolve(registro ? { ...registro } : null);
  }
  findOne(opcoes: FindOneOptions<Corretor>): Promise<Corretor | null> { return this.findOneBy(opcoes.where as FindOptionsWhere<Corretor>); }
  async existsBy(filtros: FindOptionsWhere<Corretor>): Promise<boolean> { return (await this.findOneBy(filtros)) !== null; }
  countBy(filtros: FindOptionsWhere<Corretor>): Promise<number> { return Promise.resolve([...this.registros.values()].filter(c => this.corresponde(c, filtros)).length); }
  findAndCount(opcoes: FindManyOptions<Corretor>): Promise<[Corretor[], number]> {
    const todos = [...this.registros.values()].filter(c => this.corresponde(c, opcoes.where as FindOptionsWhere<Corretor>)).sort((a, b) => a.nome.localeCompare(b.nome));
    return Promise.resolve([todos.slice(opcoes.skip, (opcoes.skip ?? 0) + (opcoes.take ?? todos.length)), todos.length]);
  }
}

describe('regras e persistência dos corretores', () => {
  let repositorio: RepositorioCorretores;
  let servico: CorretoresService;
  const usuario = { id: 99, nome: 'Dono', email: 'dono@example.com', cargo: CargoCorretor.ADMIN };
  const dados = { nome: 'Maria Silva', email: 'maria@example.com', senha: 'senha-segura-123', cpf: '52998224725', whatsapp: '66999999999', cargo: CargoCorretor.CORRETOR };
  beforeEach(() => { repositorio = new RepositorioCorretores(); servico = new CorretoresService(repositorio as unknown as Repository<Corretor>, new SenhasService()); });

  it('cria usuário auditado sem devolver senha ou hash', async () => {
    const criado = await servico.criar(dados, usuario);
    expect(criado).toMatchObject({ criado_por: usuario.id, alterado_por: usuario.id, ativo: true });
    expect(JSON.stringify(criado)).not.toContain('senha');
    expect(repositorio.registros.get(criado.id)?.senha_hash).toMatch(/^\$argon2id\$/);
  });
  it('recusa e-mail duplicado inclusive na restrição de persistência', async () => {
    await servico.criar(dados, usuario);
    jest.spyOn(repositorio, 'existsBy').mockResolvedValue(false);
    await expect(servico.criar(dados, usuario)).rejects.toBeInstanceOf(ConflictException);
    expect(repositorio.registros.size).toBe(1);
  });
  it('bootstrap serializado cria um único ADMIN e mantém os dados anteriores', async () => {
    const resultados = await Promise.allSettled([servico.criarAdministradorInicial(dados), servico.criarAdministradorInicial({ ...dados, email: 'outra@example.com' })]);
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect([...repositorio.registros.values()].map(c => c.cargo)).toEqual([CargoCorretor.ADMIN]);
  });
  it.each([{ ativo: false }, { cargo: CargoCorretor.CORRETOR }])('preserva o último administrador ativo (%j)', async alteracao => {
    const admin = await servico.criarAdministradorInicial(dados);
    await expect(servico.atualizar(admin.id, alteracao, usuario)).rejects.toBeInstanceOf(ConflictException);
    expect(repositorio.registros.get(admin.id)).toMatchObject({ ativo: true, cargo: CargoCorretor.ADMIN });
  });
  it('serializa rebaixamentos concorrentes para manter um ADMIN ativo', async () => {
    const primeiro = await servico.criar({ ...dados, cargo: CargoCorretor.ADMIN }, usuario);
    const segundo = await servico.criar({ ...dados, email: 'segunda@example.com', cargo: CargoCorretor.ADMIN }, usuario);
    const resultados = await Promise.allSettled([servico.atualizar(primeiro.id, { ativo: false }, usuario), servico.atualizar(segundo.id, { cargo: CargoCorretor.CORRETOR }, usuario)]);
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect([...repositorio.registros.values()].filter(c => c.ativo && c.cargo === CargoCorretor.ADMIN)).toHaveLength(1);
  });
  it('desativa e reativa sem excluir registro e atualiza autoria', async () => {
    const corretor = await servico.criar(dados, usuario);
    expect(await servico.desativar(corretor.id, usuario)).toMatchObject({ ativo: false, alterado_por: usuario.id });
    expect(await servico.buscarAtivoPorId(corretor.id)).toBeNull();
    expect(await servico.atualizar(corretor.id, { ativo: true }, usuario)).toMatchObject({ ativo: true });
    expect(repositorio.registros.size).toBe(1);
  });
  it('busca apenas no nome com paginação', async () => {
    await servico.criar(dados, usuario);
    await servico.criar({ ...dados, nome: 'Ana Lima', email: 'maria.ana@example.com' }, usuario);
    const resultado = await servico.listar(Object.assign(new ConsultarCorretoresDto(), { busca: 'Maria', limite: 1 }));
    expect(resultado).toMatchObject({ total: 1, pagina: 1, limite: 1, total_paginas: 1 });
    expect(resultado.itens.map(c => c.nome)).toEqual(['Maria Silva']);
  });
  it('exige senha atual correta para troca de senha e registra o próprio usuário', async () => {
    const corretor = await servico.criar(dados, usuario);
    await expect(servico.alterarSenha(corretor.id, { senha_atual: 'errada', nova_senha: 'nova-senha-123' })).rejects.toBeInstanceOf(UnauthorizedException);
    await servico.alterarSenha(corretor.id, { senha_atual: dados.senha, nova_senha: 'nova-senha-123' });
    const alterado = repositorio.registros.get(corretor.id)!;
    expect(await new SenhasService().verificar(alterado.senha_hash, 'nova-senha-123')).toBe(true);
    expect(alterado.alterado_por).toBe(corretor.id);
  });
});
