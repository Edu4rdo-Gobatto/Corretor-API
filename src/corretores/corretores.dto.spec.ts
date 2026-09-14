import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CriarCorretorDto, AtualizarCorretorDto, AtualizarPerfilDto, ConsultarCorretoresDto } from './corretores.dto';

describe('validação dos corretores', () => {
  const dados = { nome: ' Maria Silva ', email: ' MARIA@EXAMPLE.COM ', senha: 'senha-segura-123', cpf: '529.982.247-25', whatsapp: '(66) 99999-9999' };
  it('normaliza nome, email, CPF e telefone brasileiro', async () => {
    const dto = plainToInstance(CriarCorretorDto, dados);
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ nome: 'Maria Silva', email: 'maria@example.com', cpf: '52998224725', whatsapp: '66999999999', cargo: 'CORRETOR' });
  });
  it.each(['11111111111', '52998224724', '', null])('recusa CPF inválido %s', async cpf => {
    expect((await validate(plainToInstance(CriarCorretorDto, { ...dados, cpf }))).some(erro => erro.property === 'cpf')).toBe(true);
  });
  it.each(['6699999999', '66999999999', '+55 (66) 99999-9999'])('aceita telefone nacional com ou sem DDI %s', async whatsapp => {
    expect(await validate(plainToInstance(CriarCorretorDto, { ...dados, whatsapp }))).toEqual([]);
  });
  it('PATCH não atribui cargo padrão nem aceita nulos em campos obrigatórios', async () => {
    const vazio = plainToInstance(AtualizarCorretorDto, {});
    expect(vazio.cargo).toBeUndefined();
    expect(await validate(vazio)).toEqual([]);
    expect((await validate(plainToInstance(AtualizarCorretorDto, { cargo: null, ativo: null, cpf: null }))).map(erro => erro.property).sort()).toEqual(['ativo', 'cargo', 'cpf']);
  });
  it('perfil próprio impede alterar cargo, email e situação', async () => {
    const erros = await validate(plainToInstance(AtualizarPerfilDto, { nome: 'Maria', cargo: 'ADMIN', email: 'outra@example.com', ativo: false }), { whitelist: true, forbidNonWhitelisted: true });
    expect(erros.map(erro => erro.property).sort()).toEqual(['ativo', 'cargo', 'email']);
  });
  it('valida paginação e não converte false em true', async () => {
    const consulta = plainToInstance(ConsultarCorretoresDto, { ativo: 'false', pagina: '2', limite: '10' });
    expect(await validate(consulta)).toEqual([]);
    expect(consulta).toMatchObject({ ativo: false, pagina: 2, limite: 10 });
    expect((await validate(plainToInstance(ConsultarCorretoresDto, { limite: '101' }))).length).toBeGreaterThan(0);
  });
});
