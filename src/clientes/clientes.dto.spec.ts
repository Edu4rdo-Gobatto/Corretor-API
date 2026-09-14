import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ClienteManualDto, ClientePublicoDto, ConsultaClientesDto } from './clientes.dto';

describe('requisições de clientes', () => {
  const contato = { nome: 'Cliente Exemplo', telefone: '66999999999' };
  const validar = (objeto: object) => validateSync(objeto, { whitelist: true, forbidNonWhitelisted: true });
  it('exige imóvel e consentimento explícito no site', () => {
    expect(validar(plainToInstance(ClientePublicoDto, contato)).map(erro => erro.property)).toEqual(expect.arrayContaining(['imovel_id', 'consentimento']));
    expect(validar(plainToInstance(ClientePublicoDto, { ...contato, imovel_id: '00000000-0000-4000-8000-000000000001', consentimento: true }))).toEqual([]);
    expect(validar(plainToInstance(ClientePublicoDto, { ...contato, imovel_id: '00000000-0000-4000-8000-000000000001', consentimento: 'true' }))).not.toEqual([]);
  });
  it('permite cadastro manual sem imóvel e recusa consentimento forjado', () => {
    expect(validar(plainToInstance(ClienteManualDto, contato))).toEqual([]);
    expect(validar(plainToInstance(ClienteManualDto, { ...contato, consentimento: true }))).not.toEqual([]);
  });
  it('limita paginação e não permite corretor arbitrário como filtro', () => {
    expect(validar(plainToInstance(ConsultaClientesDto, { pagina: '2', limite: '20' }))).toEqual([]);
    expect(validar(plainToInstance(ConsultaClientesDto, { limite: '1001', corretor_id: 'outro' }))).not.toEqual([]);
  });
});
