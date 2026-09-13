import { BadRequestException } from '@nestjs/common';
import { validateParty, validateLease, validateDocumentFile } from './rental-rules';

const party = { kind: 'OWNER', personType: 'PF', name: 'Maria Silva', taxId: '52998224725', email: '', phone: '', address: '', birthDate: '', notes: '', bankName: '', bankAgency: '', bankAccount: '', pixKey: '', active: true };
const lease = { startDate: '2026-09-01', endDate: '2027-08-31', rentAmount: '1500.50', dueDay: 5 };
describe('rental business validation', () => {
  it('accepts PF and PJ with valid check digits', () => {
    expect(() => validateParty(party)).not.toThrow();
    expect(() => validateParty({ ...party, personType: 'PJ', taxId: '11222333000181' })).not.toThrow();
  });
  it.each(['11111111111', '52998224726', '11222333000180'])('rejects invalid taxpayer ID %s', (taxId) => {
    expect(() => validateParty({ ...party, taxId })).toThrow(BadRequestException);
  });
  it('rejects banking information attached to a tenant', () => {
    expect(() => validateParty({ ...party, kind: 'TENANT', pixKey: 'someone@example.com' })).toThrow(BadRequestException);
  });
  it('rejects impossible calendar dates and reversed lease dates', () => {
    expect(() => validateLease({ ...lease, startDate: '2026-02-30' })).toThrow(BadRequestException);
    expect(() => validateLease({ ...lease, endDate: '2026-08-31' })).toThrow(BadRequestException);
    expect(() => validateParty({ ...party, birthDate: '2026-02-30' })).toThrow(BadRequestException);
  });
  it.each(['0.00', '-1.00', 'NaN', '1e4', '1.001', '10000000000.00'])('rejects invalid rent %s', (rentAmount) => {
    expect(() => validateLease({ ...lease, rentAmount })).toThrow(BadRequestException);
  });
  it('accepts decimal amounts without binary floating point conversion', () => {
    expect(() => validateLease(lease)).not.toThrow();
  });
  it('validates signatures instead of trusting an upload content type', () => {
    expect(() => validateDocumentFile({ buffer: Buffer.from('<script>x</script>'), size: 18, mimetype: 'application/pdf', originalname: 'fake.pdf' })).toThrow(BadRequestException);
    expect(validateDocumentFile({ buffer: Buffer.from('%PDF-1.7\n'), size: 9, mimetype: 'application/pdf', originalname: '../../contrato.pdf' })).toBe('contrato.pdf');
  });
  it('rejects empty and oversized documents', () => {
    expect(() => validateDocumentFile({ buffer: Buffer.alloc(0), size: 0, mimetype: 'application/pdf', originalname: 'x.pdf' })).toThrow();
    expect(() => validateDocumentFile({ buffer: Buffer.from('%PDF-'), size: 10485761, mimetype: 'application/pdf', originalname: 'x.pdf' })).toThrow();
  });
});
