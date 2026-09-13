import { BadRequestException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { DocumentTargetDto } from './rental.dto';
import { RentalDocument, documentResponse } from './rental-document.entity';
import { RentalParty } from './rental-party.entity';
import { Lease } from './lease.entity';
import { DocumentUpload, validateDocumentFile } from './rental-rules';
export const RENTAL_STORAGE = 'RENTAL_STORAGE';
@Injectable()
export class RentalDocumentsService {
  private readonly logger = new Logger(RentalDocumentsService.name);
  constructor(@InjectRepository(RentalDocument) private readonly documents: Repository<RentalDocument>,
    @InjectRepository(RentalParty) private readonly parties: Repository<RentalParty>,
    @InjectRepository(Lease) private readonly leases: Repository<Lease>,
    @Inject(RENTAL_STORAGE) private readonly storage: S3Client,
    private readonly configuration: ConfigService) {}
  private bucket() {
    const name = this.configuration.get<string>('R2_DOCUMENTS_BUCKET');
    if (!name || name === 'corretor-midia') throw new ServiceUnavailableException('Armazenamento privado de documentos ainda não configurado.');
    return name;
  }
  private async target(target: DocumentTargetDto) {
    if (Boolean(target.partyId) === Boolean(target.leaseId)) throw new BadRequestException('Informe exatamente um vínculo: cadastro ou contrato.');
    const found = target.partyId ? await this.parties.existsBy({ id: target.partyId }) : await this.leases.existsBy({ id: target.leaseId });
    if (!found) throw new NotFoundException('Vínculo do documento não encontrado.');
    return { partyId: target.partyId ?? null, leaseId: target.leaseId ?? null };
  }
  async list(target: DocumentTargetDto) {
    const parent = await this.target(target);
    const where = parent.partyId ? { partyId: parent.partyId } : { leaseId: parent.leaseId! };
    return (await this.documents.find({ where, order: { createdAt: 'DESC', id: 'DESC' } })).map(documentResponse);
  }
  async upload(target: DocumentTargetDto, file?: DocumentUpload) {
    const bucket = this.bucket(); const fileName = validateDocumentFile(file);
    const parent = await this.target(target);
    const storageKey = `documents/${randomUUID()}`;
    await this.storage.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: file!.buffer, ContentType: file!.mimetype, CacheControl: 'private, no-store' }));
    try {
      const document = this.documents.create({ ...parent, fileName, contentType: file!.mimetype, size: file!.size, bucket, storageKey });
      return documentResponse(await this.documents.save(document));
    } catch (error) {
      try { await this.storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })); }
      catch { this.logger.error('Falha ao limpar upload de documento sem metadados; revisar objetos órfãos no bucket privado.'); }
      throw error;
    }
  }
  private async get(id: string) {
    this.bucket();
    const document = await this.documents.findOne({ where: { id } });
    if (!document) throw new NotFoundException('Documento não encontrado.');
    if (document.bucket === 'corretor-midia') throw new ServiceUnavailableException('Configuração privada de documento inválida.');
    return document;
  }
  async download(id: string) {
    const document = await this.get(id);
    const result = await this.storage.send(new GetObjectCommand({ Bucket: document.bucket, Key: document.storageKey }));
    if (!result.Body) throw new ServiceUnavailableException('Documento temporariamente indisponível.');
    const bytes = await result.Body.transformToByteArray();
    return { document: documentResponse(document), bytes };
  }
  async remove(id: string) {
    const document = await this.get(id);
    await this.storage.send(new DeleteObjectCommand({ Bucket: document.bucket, Key: document.storageKey }));
    await this.documents.remove(document);
  }
}
