import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RENTAL-004: encerramento antecipado e renovação de contrato. Só acrescenta colunas anuláveis; nenhum contrato
 * existente muda. `data_fim_contratada` guarda o fim original quando o encerramento antecipa `data_fim`, e
 * `contrato_anterior_id` liga a renovação ao contrato renovado (um por contrato, entre os não arquivados).
 */
export class EncerramentoRenovacaoContrato1789776000000 implements MigrationInterface {
  name = 'EncerramentoRenovacaoContrato1789776000000';

  async up(executor: QueryRunner): Promise<void> {
    await executor.query(`ALTER TABLE contrato
      ADD COLUMN data_fim_contratada date NULL,
      ADD COLUMN motivo_encerramento text NULL,
      ADD COLUMN contrato_anterior_id integer NULL REFERENCES contrato(id) ON DELETE RESTRICT,
      ADD CONSTRAINT contrato_encerramento_completo CHECK ((data_fim_contratada IS NULL) = (motivo_encerramento IS NULL)),
      ADD CONSTRAINT contrato_encerramento_antecipa CHECK (data_fim_contratada IS NULL OR data_fim < data_fim_contratada),
      ADD CONSTRAINT contrato_renovacao_distinta CHECK (contrato_anterior_id IS NULL OR contrato_anterior_id <> id)`);
    await executor.query('CREATE UNIQUE INDEX unica_renovacao_contrato ON contrato (contrato_anterior_id) WHERE contrato_anterior_id IS NOT NULL AND ativo = true');
  }

  async down(executor: QueryRunner): Promise<void> {
    const [{ usados }] = await executor.query(`SELECT count(*)::int AS usados FROM contrato
      WHERE data_fim_contratada IS NOT NULL OR contrato_anterior_id IS NOT NULL`) as Array<{ usados: number }>;
    if (usados > 0) throw new Error('Reversão recusada: há contratos encerrados ou renovados; restaure backup verificado em ambiente isolado.');
    await executor.query('DROP INDEX unica_renovacao_contrato');
    await executor.query(`ALTER TABLE contrato DROP CONSTRAINT contrato_renovacao_distinta, DROP CONSTRAINT contrato_encerramento_antecipa,
      DROP CONSTRAINT contrato_encerramento_completo, DROP COLUMN contrato_anterior_id, DROP COLUMN motivo_encerramento, DROP COLUMN data_fim_contratada`);
  }
}
