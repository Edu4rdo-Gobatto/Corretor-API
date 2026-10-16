/** As 27 UFs, na ordem do formulário do imóvel. */
export const ESTADOS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

/** Chave de comparação de nomes: sem acento, minúsculo e com espaços simples ("São  Paulo" = "sao paulo"). */
export const normalizarNome = (nome: string): string =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
