import { DataSource, EntityManager } from 'typeorm';
import { DriveCliente } from './drive-cliente';
import { DriveService } from './drive.service';
import { RegistroPastaDrive } from './registro-pasta-drive.entity';

describe('reserva durável de pastas no Drive', () => {
  it('confirma os IDs antes da criação remota e reutiliza as reservas após falha', async () => {
    const registros = new Map<string, RegistroPastaDrive>();
    let transacaoConfirmada = false;
    let sequencia = 0;
    let falhar = true;
    const criados = new Set<string>();
    const repositorio = {
      findOneBy: ({ chave }: { chave: string }) => Promise.resolve(registros.get(chave) ?? null),
      create: (registro: Partial<RegistroPastaDrive>) => Object.assign(new RegistroPastaDrive(), registro),
      save: (registro: RegistroPastaDrive) => { registros.set(registro.chave, registro); return Promise.resolve(registro); },
    };
    const banco = {
      transaction: async (operacao: (gerenciador: EntityManager) => Promise<RegistroPastaDrive>) => {
        transacaoConfirmada = false;
        const resultado = await operacao({ query: () => Promise.resolve([]), getRepository: () => repositorio } as unknown as EntityManager);
        transacaoConfirmada = true;
        return resultado;
      },
    };
    const cliente = {
      configuracao: () => ({ raiz: 'raiz' }), validarPastaPrivada: () => Promise.resolve(),
      gerarId: () => Promise.resolve(`pasta${++sequencia}`),
      criarPasta: (id: string) => {
        expect(transacaoConfirmada).toBe(true);
        criados.add(id);
        if (falhar && id === 'pasta3') return Promise.reject(new Error('timeout após a criação'));
        return Promise.resolve(id);
      },
    };
    const servico = new DriveService(banco as unknown as DataSource, cliente as unknown as DriveCliente);
    const contrato = { id: 'contrato', numero_contrato: 'LOC-001', locatario: 'Empresa Teste' };
    await expect(servico.criarPastaContrato(contrato, 'admin')).rejects.toThrow('Tente novamente');
    falhar = false;
    await expect(servico.criarPastaContrato(contrato, 'admin')).resolves.toBe('https://drive.google.com/drive/folders/pasta3');
    expect(registros.size).toBe(3); expect(criados.size).toBe(3); expect(sequencia).toBe(3);
  });
});
