import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Caracteristica, FinalidadeImovel, TipoImovel } from './cadastros.entity';
import { ConsultaCadastrosDto } from './cadastros.dto';
import { CadastrosService } from './cadastros.service';

describe('Cadastros dinâmicos', () => {
  const usuario: UsuarioAutenticado = { id: 'responsavel', nome: 'Responsável', email: 'teste@example.test', cargo: 'CORRETOR' };
  const registro = Object.assign(new TipoImovel(), { id: 'tipo', nome: 'Galpão', slug: 'galpao', ativo: true });
  const tipos = { findAndCount: jest.fn(), findOneBy: jest.fn(), create: jest.fn((dados: Partial<TipoImovel>) => Object.assign(new TipoImovel(), dados)), save: jest.fn((dados: TipoImovel) => Promise.resolve(dados)) };
  const caracteristicas = { create: jest.fn((dados: Partial<Caracteristica>) => Object.assign(new Caracteristica(), dados)), save: jest.fn((dados: Caracteristica) => Promise.resolve(dados)) };
  const servico = new CadastrosService(tipos as unknown as Repository<TipoImovel>, tipos as unknown as Repository<FinalidadeImovel>, caracteristicas as unknown as Repository<Caracteristica>);

  beforeEach(() => { tipos.findAndCount.mockResolvedValue([[registro], 1]); tipos.findOneBy.mockResolvedValue(Object.assign(new TipoImovel(), registro)); tipos.save.mockImplementation((dados) => Promise.resolve(dados)); });

  it('permite ao corretor criar novos tipos sem enum fixo e preenche auditoria', async () => {
    const resultado = await servico.criar('tipos-imovel', { nome: 'Centro de Distribuição' }, usuario);
    expect(resultado).toMatchObject({ nome: 'Centro de Distribuição', slug: 'centro-de-distribuicao', ativo: true });
    expect(tipos.save).toHaveBeenCalledWith(expect.objectContaining({ criado_por: usuario.id, alterado_por: usuario.id }));
  });

  it('nome/slug duplicado retorna conflito legível', async () => {
    tipos.save.mockRejectedValue({ code: '23505' });
    await expect(servico.criar('tipos-imovel', { nome: 'Galpão' }, usuario)).rejects.toThrow(ConflictException);
  });

  it('filtra ativos no público e permite internos inativos para reativação', async () => {
    await servico.listar('tipos-imovel', new ConsultaCadastrosDto(), true);
    expect(tipos.findAndCount).toHaveBeenLastCalledWith(expect.objectContaining({ where: { ativo: true } }));
    await servico.listar('tipos-imovel', new ConsultaCadastrosDto());
    expect(tipos.findAndCount).toHaveBeenLastCalledWith(expect.objectContaining({ where: {} }));
  });

  it('desativa e reativa sem excluir; renomear preserva slug estável', async () => {
    expect(await servico.atualizar('tipos-imovel', registro.id, { nome: 'Galpão comercial', ativo: false }, usuario)).toMatchObject({ ativo: false, slug: 'galpao' });
    expect(await servico.atualizar('tipos-imovel', registro.id, { ativo: true }, usuario)).toMatchObject({ ativo: true });
    expect(tipos.save).toHaveBeenCalledWith(expect.objectContaining({ alterado_por: usuario.id }));
  });

  it('cria característica com ícone opcional sem inventar slug ou JSON', async () => {
    const resultado = await servico.criar('caracteristicas', { nome: 'Pé direito', icone: 'altura' }, usuario);
    expect(resultado).toMatchObject({ nome: 'Pé direito', icone: 'altura' });
    expect(resultado).not.toHaveProperty('slug');
  });
});
