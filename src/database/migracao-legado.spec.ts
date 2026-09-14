import { createCipheriv, createHash } from 'node:crypto';
import { decifrarTextoLegado, validarComplementos } from './migracao-legado';

describe('transição segura do legado', () => {
  it('não inventa CPF para corretores existentes e aceita mapa explícito válido', () => {
    expect(() => validarComplementos({}, ['corretor-1'])).toThrow('CPF');
    expect(() => validarComplementos({ corretores: { 'corretor-1': { cpf: '11111111111' } } }, ['corretor-1'])).toThrow('CPF');
    expect(validarComplementos({ corretores: { 'corretor-1': { cpf: '52998224725' } } }, ['corretor-1']).corretores['corretor-1'].cpf).toBe('52998224725');
  });
  it('aceita complemento de cliente manual para comissões que nunca tiveram lead', () => {
    const clienteId = '00000000-0000-4000-8000-000000000010';
    const corretorId = '00000000-0000-4000-8000-000000000001';
    const dados = validarComplementos({ clientes_manuais: { [clienteId]: { nome: 'Cliente Real', telefone: '66999999999', corretor_id: corretorId } } }, []);
    expect(dados.clientes_manuais[clienteId]).toMatchObject({ nome: 'Cliente Real', corretor_id: corretorId });
    expect(() => validarComplementos({ clientes_manuais: { [clienteId]: { nome: 'Cliente', telefone: 'invalido', corretor_id: corretorId, consentimento: true } } }, [])).toThrow('cliente manual');
  });
  it('decifra textos históricos sem permitir chave errada ou revelar o conteúdo em erros', () => {
    const chave = 'chave-apenas-para-teste';
    const cifra = createCipheriv('aes-256-gcm', createHash('sha256').update(chave).digest(), Buffer.alloc(12));
    const texto = Buffer.concat([cifra.update('Nome Privado', 'utf8'), cifra.final()]);
    const armazenado = `enc:v1:${Buffer.alloc(12).toString('base64url')}.${cifra.getAuthTag().toString('base64url')}.${texto.toString('base64url')}`;
    expect(decifrarTextoLegado(armazenado, chave)).toBe('Nome Privado');
    expect(() => decifrarTextoLegado(armazenado, 'errada')).toThrow('Não foi possível decifrar');
    expect(decifrarTextoLegado('Texto sem cifra', undefined)).toBe('Texto sem cifra');
    expect(decifrarTextoLegado(null, undefined)).toBeNull();
  });
});
