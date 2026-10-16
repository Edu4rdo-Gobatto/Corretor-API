import { ConflictException } from '@nestjs/common';
import { CadastrosService } from './cadastros.service';
import { Cidade } from './cadastros.entity';

function servico(cidades: Partial<Record<'save' | 'findAndCount' | 'findOneBy', jest.Mock>> = {}) {
  const repositorio = {
    create: jest.fn((dados: object) => Object.assign(new Cidade(), dados)),
    save: cidades.save ?? jest.fn((item: Cidade) => Promise.resolve({ ...item, id: 5 })),
    findAndCount: cidades.findAndCount ?? jest.fn(() => Promise.resolve([[], 0])),
    findOneBy: cidades.findOneBy ?? jest.fn(() => Promise.resolve(null)),
  };
  return { repositorio, cadastros: new CadastrosService({} as never, {} as never, {} as never, repositorio as never) };
}
const usuario = { id: 1, cargo: 'ADMIN' } as never;

describe('CadastrosService: cidades', () => {
  it('grava o nome normalizado e devolve o estado, sem slug', async () => {
    const { repositorio, cadastros } = servico();
    const criada = await cadastros.criar('cidades', { nome: 'São José do Rio Claro', estado: 'MT' }, usuario);
    expect(repositorio.save).toHaveBeenCalledWith(expect.objectContaining({ nome_normalizado: 'sao jose do rio claro', estado: 'MT' }));
    expect(criada).toMatchObject({ id: 5, nome: 'São José do Rio Claro', estado: 'MT', ativo: true });
    expect(criada).not.toHaveProperty('slug');
  });

  it('cidade repetida no mesmo estado vira 409 com mensagem própria', async () => {
    const { cadastros } = servico({ save: jest.fn(() => Promise.reject(Object.assign(new Error('duplicada'), { code: '23505' }))) });
    await expect(cadastros.criar('cidades', { nome: 'Juara', estado: 'MT' }, usuario)).rejects.toThrow(new ConflictException('Cidade já cadastrada neste estado, inclusive entre as inativas.'));
  });

  it('lista pública traz só as ativas, ordenadas por nome e estado', async () => {
    const { repositorio, cadastros } = servico();
    await cadastros.listar('cidades', { pagina: 1, limite: 100 }, true);
    expect(repositorio.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { ativo: true }, order: { nome: 'ASC', estado: 'ASC', id: 'ASC' } }));
  });

  it('renomear atualiza o nome normalizado', async () => {
    const existente = Object.assign(new Cidade(), { id: 5, nome: 'Juara', estado: 'MT', ativo: true });
    const { repositorio, cadastros } = servico({ findOneBy: jest.fn(() => Promise.resolve(existente)) });
    await cadastros.atualizar('cidades', 5, { nome: 'Juína' }, usuario);
    expect(repositorio.save).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Juína', nome_normalizado: 'juina' }));
  });
});
