import { Logger } from 'typeorm';

// Resiste inclusive à CLI TypeORM, que sobrepõe a opção logging do DataSource.
// Parâmetros, linhas rejeitadas e mensagens do driver podem conter dados pessoais.
export class LoggerSeguro implements Logger {
  logQuery(consulta?: string, parametros?: unknown[]): void { void consulta; void parametros; }
  logQueryError(erro?: string | Error, consulta?: string, parametros?: unknown[]): void { void erro; void consulta; void parametros; }
  logQuerySlow(): void { /* Métricas devem usar contadores, sem SQL. */ }
  logSchemaBuild(): void { /* O comando exibe apenas o resultado agregado. */ }
  logMigration(): void { /* O comando exibe apenas o resultado agregado. */ }
  log(): void { /* Não registrar mensagens arbitrárias do ORM. */ }
}

export function mensagemFalhaOperacional(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string' && /^[0-9A-Z]{5}$/.test(erro.code)) {
    return `Falha na operação do banco (${erro.code}). Nenhum detalhe de dados foi registrado.`;
  }
  return 'Falha na operação do banco. Consulte a configuração, o backup e os pré-requisitos da migração; nenhum dado sensível foi registrado.';
}
