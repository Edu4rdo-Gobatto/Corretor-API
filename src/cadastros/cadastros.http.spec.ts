import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request } from 'express';
import { AutenticacaoGuard } from '../autenticacao/autenticacao.guard';
import { CargosGuard } from '../autenticacao/cargos.guard';
import { ImoveisController, ImoveisPublicosController } from '../imoveis/imoveis.controller';
import { ImoveisService } from '../imoveis/imoveis.service';
import { MidiasController } from '../midias/midias.controller';
import { MidiasService } from '../midias/midias.service';
import { controladoresCadastros } from './cadastros.controller';
import { CadastrosService } from './cadastros.service';

describe('Rotas portuguesas de catálogo, cadastros e mídia (serviços substituídos)', () => {
  let aplicacao: INestApplication;
  let origem: string;
  const id = '86e8e2b2-7611-4a2d-8d08-c4d0aabf11d3';
  const cadastros = { listar: jest.fn().mockResolvedValue({ itens: [] }), criar: jest.fn().mockResolvedValue({ id }), atualizar: jest.fn().mockResolvedValue({ id }), encontrar: jest.fn().mockResolvedValue({ id }) };
  const imoveis = { listar_publicos: jest.fn().mockResolvedValue({ itens: [] }), listar_internos: jest.fn().mockResolvedValue({ itens: [] }), encontrar_interno: jest.fn().mockResolvedValue({ id }) };
  const midias = { enviar: jest.fn().mockResolvedValue([{ id }]), adicionar_embed: jest.fn().mockResolvedValue({ id }) };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [...controladoresCadastros, ImoveisController, ImoveisPublicosController, MidiasController], providers: [
      { provide: CadastrosService, useValue: cadastros }, { provide: ImoveisService, useValue: imoveis }, { provide: MidiasService, useValue: midias }, CargosGuard,
    ] }).overrideGuard(AutenticacaoGuard).useValue({ canActivate: (contexto: ExecutionContext) => {
      const requisicao = contexto.switchToHttp().getRequest<Request & { user?: unknown }>();
      if (!['Bearer teste', 'Bearer admin'].includes(String(requisicao.headers.authorization))) throw new UnauthorizedException();
      requisicao.user = { id, nome: 'Corretor', email: 'teste@example.test', cargo: String(requisicao.headers.authorization) === 'Bearer admin' ? 'ADMIN' : 'CORRETOR' };
      return true;
    } }).compile();
    aplicacao = modulo.createNestApplication();
    aplicacao.useLogger(false);
    aplicacao.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await aplicacao.listen(0, '127.0.0.1');
    origem = await aplicacao.getUrl();
  });
  afterAll(async () => { await aplicacao?.close(); });

  function requisitar(caminho: string, metodo = 'GET', dados?: unknown, autenticado = true, admin = false) {
    return fetch(`${origem}${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json', ...(autenticado ? { Authorization: admin ? 'Bearer admin' : 'Bearer teste' } : {}) }, body: dados === undefined ? undefined : JSON.stringify(dados) });
  }

  it('registra as três categorias públicas e seus CRUDs administrativos independentes', async () => {
    for (const categoria of ['tipos-imovel', 'finalidades-imovel', 'caracteristicas']) {
      expect((await requisitar(`/${categoria}`, 'GET', undefined, false)).status).toBe(200);
      expect(cadastros.listar).toHaveBeenLastCalledWith(categoria, expect.objectContaining({ pagina: 1, limite: 100 }), true);
      expect((await requisitar(`/admin/${categoria}`, 'POST', { nome: 'Novo cadastro' }, true, true)).status).toBe(201);
      expect(cadastros.criar).toHaveBeenLastCalledWith(categoria, expect.objectContaining({ nome: 'Novo cadastro' }), expect.objectContaining({ cargo: 'ADMIN' }));
      expect((await requisitar(`/admin/${categoria}/${id}`, 'DELETE', undefined, true, true)).status).toBe(204);
      expect(cadastros.atualizar).toHaveBeenLastCalledWith(categoria, id, { ativo: false }, expect.objectContaining({ id }));
    }
  });

  it('bloqueia corretor comum no CRUD global de cadastros', async () => {
    expect((await requisitar('/admin/tipos-imovel', 'POST', { nome: 'Não permitido' })).status).toBe(403);
    expect((await requisitar(`/admin/caracteristicas/${id}`, 'PATCH', { nome: 'Não permitido' })).status).toBe(403);
  });

  it('exige autenticação em cadastros, imóveis internos e mídia', async () => {
    for (const caminho of ['/admin/tipos-imovel', '/admin/finalidades-imovel', '/admin/caracteristicas', '/admin/imoveis']) expect((await requisitar(caminho, 'GET', undefined, false)).status).toBe(401);
    expect((await requisitar(`/admin/imoveis/${id}/midias/video-embed`, 'POST', { url: 'https://vimeo.com/123' }, false)).status).toBe(401);
  });

  it('rejeita campos de auditoria, null e slug em características pelo pipe global', async () => {
    expect((await requisitar('/admin/tipos-imovel', 'POST', { nome: 'Galpão', criado_por: id }, true, true)).status).toBe(400);
    expect((await requisitar('/admin/caracteristicas', 'POST', { nome: 'Garagem', slug: 'garagem' }, true, true)).status).toBe(400);
    expect((await requisitar(`/admin/tipos-imovel/${id}`, 'PATCH', { nome: null }, true, true)).status).toBe(400);
  });

  it('filtros de status são internos; UUID inválido é rejeitado antes do serviço', async () => {
    expect((await requisitar('/imoveis?status=CONCLUIDO', 'GET', undefined, false)).status).toBe(400);
    expect((await requisitar('/admin/imoveis?status=CONCLUIDO&ativo=false')).status).toBe(200);
    expect(imoveis.listar_internos).toHaveBeenCalledWith(expect.objectContaining({ status: 'CONCLUIDO', ativo: false }));
    expect((await requisitar('/admin/imoveis/invalido')).status).toBe(400);
  });

  it('upload multipart usa campo arquivos e recebe Buffer na memória', async () => {
    const formulario = new FormData();
    formulario.append('arquivos', new Blob([new Uint8Array([255, 216, 255, 224])], { type: 'image/jpeg' }), 'foto.jpg');
    const resposta = await fetch(`${origem}/admin/imoveis/${id}/midias`, { method: 'POST', headers: { Authorization: 'Bearer teste' }, body: formulario });
    expect(resposta.status).toBe(201);
    expect(midias.enviar).toHaveBeenCalledWith(id, [expect.objectContaining({ buffer: Buffer.from([255, 216, 255, 224]), mimetype: 'image/jpeg', size: 4 })], expect.objectContaining({ id }));
  });
});
