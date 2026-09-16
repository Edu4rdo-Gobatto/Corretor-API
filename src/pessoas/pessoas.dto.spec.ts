import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AtualizarPessoaDto, ConsultaPessoasDto, CriarPessoaDto, PessoaPublicaDto } from './pessoas.dto';

describe('requisições de pessoas', () => {
  const contato = { nome: 'Pessoa Exemplo', telefone: '66999999999' };
  const validar = (objeto: object) => validateSync(objeto, { whitelist: true, forbidNonWhitelisted: true });
  it('o site exige imóvel e consentimento explícito e não aceita a ficha completa', () => {
    expect(validar(plainToInstance(PessoaPublicaDto, contato)).map(erro => erro.property)).toEqual(expect.arrayContaining(['imovel_id', 'consentimento']));
    expect(validar(plainToInstance(PessoaPublicaDto, { ...contato, imovel_id: 12, consentimento: true }))).toEqual([]);
    expect(validar(plainToInstance(PessoaPublicaDto, { ...contato, imovel_id: 12, consentimento: 'true' }))).not.toEqual([]);
    expect(validar(plainToInstance(PessoaPublicaDto, { ...contato, imovel_id: 12, consentimento: true, cpf_cnpj: '52998224725' }))).not.toEqual([]);
  });
  it('cadastro completo aceita CPF/CNPJ pontuado, dados bancários e situação, e recusa consentimento forjado', () => {
    const dto = plainToInstance(CriarPessoaDto, { ...contato, tipo_pessoa: 'PF', cpf_cnpj: '529.982.247-25', banco_nome: 'Banco', chave_pix: 'pix@example.test', status_contato: 'FINALIZADO' });
    expect(validar(dto)).toEqual([]);
    expect(dto.cpf_cnpj).toBe('52998224725');
    expect(validar(plainToInstance(CriarPessoaDto, { ...contato, cpf_cnpj: '11111111111' })).length).toBeGreaterThan(0);
    expect(validar(plainToInstance(CriarPessoaDto, { ...contato, consentimento: true }))).not.toEqual([]);
  });
  it('PATCH permite limpar campos opcionais mas não os obrigatórios; a consulta converte filtros', () => {
    expect(validar(plainToInstance(AtualizarPessoaDto, { email: null, cpf_cnpj: null, ativo: false }))).toEqual([]);
    expect(validar(plainToInstance(AtualizarPessoaDto, { nome: null })).length).toBeGreaterThan(0);
    const consulta = plainToInstance(ConsultaPessoasDto, { pagina: '2', limite: '20', status_contato: 'PENDENTE', imovel_id: '4', ativo: 'false' });
    expect(validar(consulta)).toEqual([]);
    expect(consulta).toMatchObject({ pagina: 2, limite: 20, status_contato: 'PENDENTE', imovel_id: 4, ativo: false });
    expect(validar(plainToInstance(ConsultaPessoasDto, { limite: '1001', papel: 'LOCADOR' }))).not.toEqual([]);
  });
});
