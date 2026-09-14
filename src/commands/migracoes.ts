import 'dotenv/config';
import { stat } from 'node:fs/promises';
import { mensagemFalhaOperacional } from '../database/log-seguro';

async function executar(): Promise<void> {
  const acao = process.argv[2];
  if (!['listar', 'executar', 'reverter'].includes(acao)) throw new Error('Configuração: ação de migração inválida.');
  if (acao !== 'listar') {
    const caminho = process.env.MIGRACAO_BACKUP_ARQUIVO;
    const arquivo = caminho ? await stat(caminho).catch(() => null) : null;
    if (!arquivo?.isFile() || arquivo.size === 0) throw new Error('Configuração: MIGRACAO_BACKUP_ARQUIVO deve apontar para backup verificado e não vazio, fora do Git.');
  }
  const { default: banco } = await import('../database/data-source');
  try {
    await banco.initialize();
    if (acao === 'listar') console.info(`Migrações pendentes: ${await banco.showMigrations() ? 'sim' : 'não'}.`);
    else if (acao === 'executar') {
      const executadas = await banco.runMigrations({ transaction: 'all' });
      console.info(`Migrações concluídas: ${executadas.length}.`);
    } else {
      await banco.undoLastMigration({ transaction: 'all' });
      console.info('Última migração revertida.');
    }
  } finally {
    if (banco.isInitialized) await banco.destroy();
  }
}

void executar().catch((erro: unknown) => {
  // Somente mensagens controladas pelo código; nunca imprimir QueryFailedError/stack/parameters.
  const mensagem = erro instanceof Error && /^(Configuração|Migração interrompida:|Não foi possível decifrar dados legados\.|MIGRACAO_COMPLEMENTOS_ARQUIVO|Reversão automática recusada:)/.test(erro.message)
    ? erro.message : mensagemFalhaOperacional(erro);
  console.error(mensagem);
  process.exitCode = 1;
});
