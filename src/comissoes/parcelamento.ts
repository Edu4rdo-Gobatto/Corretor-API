import { BadRequestException } from '@nestjs/common';
import { dataCivilValida, decimalEmCentavos } from '../comum/validacao';

export function distribuirParcelas(valor: string, quantidade: number): string[] {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 600) {
    throw new BadRequestException('Quantidade de parcelas deve estar entre 1 e 600.');
  }
  const total = decimalEmCentavos(valor);
  if (total < BigInt(quantidade) || total > 999999999999n) {
    throw new BadRequestException('O valor deve permitir parcelas positivas dentro do limite monetário.');
  }
  const base = total / BigInt(quantidade);
  const resto = total % BigInt(quantidade);
  return Array.from({ length: quantidade }, (_, indice) => {
    const centavos = base + (BigInt(indice) < resto ? 1n : 0n);
    return `${centavos / 100n}.${String(centavos % 100n).padStart(2, '0')}`;
  });
}
export function vencimentoMensal(data: string, meses: number): string {
  if (!dataCivilValida(data) || !Number.isInteger(meses) || meses < 0 || meses > 599) {
    throw new BadRequestException('Data de vencimento inválida.');
  }
  const [ano, mes, dia] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, mes - 1 + meses + 1, 0));
  const resultado = new Date(Date.UTC(ultimo.getUTCFullYear(), ultimo.getUTCMonth(), Math.min(dia, ultimo.getUTCDate())));
  if (resultado.getUTCFullYear() > 9999) throw new BadRequestException('Vencimento fora do intervalo permitido.');
  return resultado.toISOString().slice(0, 10);
}
