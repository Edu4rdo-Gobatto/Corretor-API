import { BadRequestException } from '@nestjs/common';
import { Imovel, StatusImovel } from '../imoveis/imovel.entity';
import { Pessoa } from './pessoa.entity';
import { PessoasService } from './pessoas.service';
import { PessoaPublicaDto } from './pessoas.dto';

const combina = (registro: Record<string, unknown>, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([chave, valor]) => valor !== null && typeof valor === 'object'
    ? combina((registro[chave] ?? {}) as Record<string, unknown>, valor as Record<string, unknown>)
    : registro[chave] === valor);

function servico(imovel: Record<string, unknown>) {
  const pessoas = { create: jest.fn((dados: object) => dados), save: jest.fn((dados: object) => Promise.resolve({ id: 99, ...dados })) };
  const imoveis = { findOne: jest.fn(({ where }: { where: Record<string, unknown> }) => Promise.resolve(combina(imovel, where) ? imovel : null)) };
  const gerenciador = { getRepository: (entidade: unknown) => entidade === Imovel ? imoveis : entidade === Pessoa ? pessoas : null };
  const banco = { transaction: jest.fn((trabalho: (g: typeof gerenciador) => unknown) => trabalho(gerenciador)) };
  const avisos = { novoContato: jest.fn() };
  return { avisos, pessoas: new PessoasService({} as never, banco as never, avisos as never) };
}

const contato = { imovel_id: 1, nome: 'Cliente', telefone: '65999999999', consentimento: true } as PessoaPublicaDto;
const base = { id: 1, titulo: 'Prédio comercial', ativo: true, corretor_id: 7, corretor: { id: 7, ativo: true, nome: 'Corretor', email: 'c@exemplo.com' } };

describe('PessoasService: contato pelo site', () => {
  it('aceita contato para imóvel exibido no site mesmo vendido e com corretor desativado', async () => {
    const { pessoas, avisos } = servico({ ...base, status: StatusImovel.VENDIDO, corretor: { ...base.corretor, ativo: false } });
    await expect(pessoas.criarPublico(contato, '127.0.0.1')).resolves.toEqual({ id: 99 });
    expect(avisos.novoContato).toHaveBeenCalledTimes(1);
  });

  it('recusa contato para imóvel retirado do site', async () => {
    const { pessoas, avisos } = servico({ ...base, status: StatusImovel.DISPONIVEL, ativo: false });
    await expect(pessoas.criarPublico(contato, '127.0.0.1')).rejects.toBeInstanceOf(BadRequestException);
    expect(avisos.novoContato).not.toHaveBeenCalled();
  });
});
