import { BadRequestException } from '@nestjs/common';

export type DocumentUpload = { buffer: Buffer; size: number; mimetype: string; originalname: string };
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31') return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validTaxId(value: string, personType: string): boolean {
  if (!/^\d+$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digits = [...value].map(Number);
  if (personType === 'PF' && digits.length === 11) {
    return [9, 10].every(length => {
      const remainder = digits.slice(0, length).reduce((sum, digit, i) => sum + digit * (length + 1 - i), 0) * 10 % 11;
      return (remainder === 10 ? 0 : remainder) === digits[length];
    });
  }
  if (personType === 'PJ' && digits.length === 14) {
    return [12, 13].every(length => {
      const remainder = digits.slice(0, length).reduce((sum, digit, i) => sum + digit * ((length - 1 - i) % 8 + 2), 0) % 11;
      return (remainder < 2 ? 0 : 11 - remainder) === digits[length];
    });
  }
  return false;
}
export function validateParty(party: { personType: string; taxId: string; kind: string; bankName?: string; bankAgency?: string; bankAccount?: string; pixKey?: string; birthDate?: string }): void {
  if (!validTaxId(party.taxId, party.personType)) throw new BadRequestException('Informe um CPF/CNPJ válido, somente números.');
  if (party.kind === 'TENANT' && [party.bankName, party.bankAgency, party.bankAccount, party.pixKey].some(Boolean)) throw new BadRequestException('Dados bancários são exclusivos do proprietário.');
  if (party.birthDate && (!validDate(party.birthDate) || party.birthDate > new Date().toISOString().slice(0, 10))) throw new BadRequestException('Data de nascimento inválida.');
}
export function validateLease(lease: { startDate: string; endDate: string; rentAmount: string; dueDay: number }): void {
  if (!validDate(lease.startDate) || !validDate(lease.endDate) || lease.startDate > lease.endDate) throw new BadRequestException('Informe um período válido para o contrato.');
  if (!/^(0|[1-9]\d{0,9})\.\d{2}$/.test(lease.rentAmount) || /^0\.00$/.test(lease.rentAmount)) throw new BadRequestException('Aluguel deve ser positivo, com duas casas decimais.');
  if (!Number.isInteger(lease.dueDay) || lease.dueDay < 1 || lease.dueDay > 31) throw new BadRequestException('Dia de vencimento deve estar entre 1 e 31.');
}
export function validateDocumentFile(file: DocumentUpload | undefined): string {
  if (!file || !file.size || file.size > MAX_DOCUMENT_SIZE || file.buffer.length !== file.size) throw new BadRequestException('Envie um documento de até 10 MiB.');
  const b = file.buffer;
  const valid = (file.mimetype === 'application/pdf' && b.subarray(0, 5).toString() === '%PDF-')
    || (file.mimetype === 'image/jpeg' && b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    || (file.mimetype === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  if (!valid) throw new BadRequestException('Formato inválido. Envie PDF, JPEG ou PNG.');
  const name = [...file.originalname.replace(/\\/g, '/').split('/').pop()!].filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127 && !'";'.includes(char)).join('').trim();
  return (name || 'documento').slice(0, 180);
}
