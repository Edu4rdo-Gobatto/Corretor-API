import { registerDecorator, ValidationOptions } from 'class-validator';

export function documentoValido(valor: string): boolean {
  if (!/^\d{11}$|^\d{14}$/.test(valor) || /^(\d)\1+$/.test(valor)) return false;
  const digitos = [...valor].map(Number);
  for (let posicao = digitos.length - 2; posicao < digitos.length; posicao++) {
    let soma = 0;
    for (let indice = 0; indice < posicao; indice++) {
      const peso = digitos.length === 11 ? posicao + 1 - indice : (posicao - 1 - indice) % 8 + 2;
      soma += digitos[indice] * peso;
    }
    const resto = soma % 11;
    if (digitos[posicao] !== (resto < 2 ? 0 : 11 - resto)) return false;
  }
  return true;
}

export function telefoneValido(valor: string): boolean {
  if (!/^[+\d() .-]+$/.test(valor)) return false;
  let numero = valor.replace(/\D/g, '');
  if ((numero.length === 12 || numero.length === 13) && numero.startsWith('55')) numero = numero.slice(2);
  return /^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(numero);
}

export function dataCivilValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(data.valueOf()) && data.toISOString().slice(0, 10) === valor;
}

export function decimalEmCentavos(valor: string): bigint {
  if (!/^(0|[1-9]\d{0,9})\.\d{2}$/.test(valor)) throw new Error('Valor decimal inválido.');
  return BigInt(valor.replace('.', ''));
}

function validador(nome: string, validar: (valor: string) => boolean, opcoes?: ValidationOptions): PropertyDecorator {
  return (alvo, propriedade) => registerDecorator({
    name: nome, target: alvo.constructor, propertyName: String(propriedade), options: opcoes,
    validator: { validate: (valor: unknown) => typeof valor === 'string' && validar(valor) },
  });
}

export const DocumentoValido = (opcoes?: ValidationOptions): PropertyDecorator => validador('documentoValido', documentoValido, opcoes);
export const TelefoneValido = (opcoes?: ValidationOptions): PropertyDecorator => validador('telefoneValido', telefoneValido, opcoes);
export const DataCivilValida = (opcoes?: ValidationOptions): PropertyDecorator => validador('dataCivilValida', dataCivilValida, opcoes);

export function escaparBusca(valor: string): string {
  return valor.replace(/[\\%_]/g, '\\$&');
}
