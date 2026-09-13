import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Repository } from 'typeorm';
import { RentalDocumentsService } from './rental-documents.service';
import { RentalDocument } from './rental-document.entity';
import { RentalParty } from './rental-party.entity';
import { Lease } from './lease.entity';
import { rentalEncryption } from './rental-encryption';

describe('private rental documents', () => {
  const records: RentalDocument[] = [];
  const repository = { create: (x: object) => x, save: (x: RentalDocument) => { records.push(x); return Promise.resolve(x); }, findOne: () => Promise.resolve(records[0]), remove: () => { records.length = 0; return Promise.resolve(); } };
  const send = jest.fn<Promise<unknown>, [PutObjectCommand | GetObjectCommand | DeleteObjectCommand]>();
  const storage = { send } as unknown as S3Client;
  const parties = { existsBy: () => Promise.resolve(true) } as unknown as Repository<RentalParty>;
  const leases = { existsBy: () => Promise.resolve(true) } as unknown as Repository<Lease>;
  const service = (bucket?: string) => new RentalDocumentsService(repository as unknown as Repository<RentalDocument>, parties, leases, storage, new ConfigService({ R2_DOCUMENTS_BUCKET: bucket }));
  const file = { buffer: Buffer.from('%PDF-1.7\n'), size: 9, mimetype: 'application/pdf', originalname: 'contrato.pdf' };
  beforeEach(() => { records.length = 0; send.mockReset(); send.mockResolvedValue({}); });
  it.each([undefined, 'corretor-midia'])('fails closed with unsafe bucket %s', async bucket => {
    await expect(service(bucket).upload({ partyId: 'party' }, file)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(records).toHaveLength(0);
  });
  it('uploads only to the private bucket and never exposes the object address', async () => {
    const result = await service('private-rentals').upload({ partyId: 'party' }, file);
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[0][0].input.Bucket).toBe('private-rentals');
    expect(result).toMatchObject({ fileName: 'contrato.pdf', partyId: 'party' });
    expect(result).not.toHaveProperty('storageKey'); expect(result).not.toHaveProperty('bucket'); expect(result).not.toHaveProperty('url');
  });
  it('rejects ambiguous document parents', async () => {
    await expect(service('private-rentals').upload({ partyId: 'party', leaseId: 'lease' }, file)).rejects.toThrow();
    await expect(service('private-rentals').upload({}, file)).rejects.toThrow();
  });
  it('compensates an upload when metadata persistence fails', async () => {
    const save = jest.spyOn(repository, 'save').mockRejectedValueOnce(new Error('database'));
    await expect(service('private-rentals').upload({ partyId: 'party' }, file)).rejects.toThrow('database');
    expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    save.mockRestore();
  });
  it('returns document bytes for the authenticated download and removes storage on delete', async () => {
    await service('private-rentals').upload({ partyId: 'party' }, file);
    send.mockResolvedValueOnce({ Body: { transformToByteArray: () => Promise.resolve(file.buffer) } });
    const downloaded = await service('private-rentals').download('id');
    expect(Buffer.from(downloaded.bytes)).toEqual(file.buffer);
    expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
    await service('private-rentals').remove('id');
    expect(records).toHaveLength(0);
  });
});
describe('rental encrypted persistence', () => {
  it('encrypts even text resembling an encryption envelope and detects tampering', () => {
    const before = process.env.LEADS_ENCRYPTION_KEY;
    process.env.LEADS_ENCRYPTION_KEY = 'test-rental-key-with-at-least-thirty-two-characters';
    try {
      const original = { taxId: '52998224725', pixKey: 'enc:v1:fake' };
      const stored = rentalEncryption.to(original) as string;
      expect(stored).not.toContain(original.taxId);
      expect(rentalEncryption.from(stored)).toEqual(original);
      expect(() => { rentalEncryption.from(stored.slice(0, -5) + 'AAAAA'); }).toThrow();
    } finally { if (before === undefined) delete process.env.LEADS_ENCRYPTION_KEY; else process.env.LEADS_ENCRYPTION_KEY = before; }
  });
});
