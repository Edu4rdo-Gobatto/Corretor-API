import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AgentRole } from '../agents/agent.entity';
import { AgentProfile } from '../agents/dto/agent-profile.dto';
import { Property } from '../properties/property.entity';
import { CreateMediaEmbedDto } from './dto/create-media-embed.dto';
import { canonicalEmbedUrl } from './embed-url';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { MediaType, PropertyMedia } from './property-media.entity';

export const R2_S3_CLIENT = 'R2_S3_CLIENT';
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 30 * 1024 * 1024;

const imageTypes = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'],
]);
const videoTypes = new Map([
  ['video/mp4', '.mp4'], ['video/webm', '.webm'],
]);

type UploadFile = { buffer: Buffer; mimetype: string; size: number };

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(PropertyMedia) private readonly media: Repository<PropertyMedia>,
    @InjectRepository(Property) private readonly properties: Repository<Property>,
    @Inject(R2_S3_CLIENT) private readonly storage: S3Client,
    private readonly configuration: ConfigService,
  ) {}

  async upload(propertyId: string, files: UploadFile[], viewer: AgentProfile): Promise<PropertyMedia[]> {
    const property = await this.findOwnedProperty(propertyId, viewer);
    if (files.length === 0) throw new BadRequestException('Envie pelo menos um arquivo.');
    const existing = await this.listForProperty(property.id);
    const uploadedKeys: string[] = [];
    const entities: PropertyMedia[] = [];

    try {
      const results = await Promise.allSettled(files.map(async (file, offset) => {
        const { type, extension } = this.validateFile(file);
        const storageKey = `properties/${property.id}/${randomUUID()}${extension}`;
        await this.storage.send(new PutObjectCommand({ Bucket: 'corretor-midia', Key: storageKey, Body: file.buffer, ContentType: file.mimetype }));
        uploadedKeys.push(storageKey);
        return this.media.create({ propertyId: property.id, property, type, url: this.publicUrl(storageKey), storageKey,
          orderIndex: existing.length + offset, isCover: existing.length === 0 && offset === 0 });
      }));
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected) throw rejected.reason;
      entities.push(...results.map((result) => (result as PromiseFulfilledResult<PropertyMedia>).value));
      return await this.media.save(entities);
    } catch (error) {
      await Promise.all(uploadedKeys.map((key) => this.deleteFromStorage(key)));
      throw error;
    }
  }

  async addEmbed(propertyId: string, dto: CreateMediaEmbedDto, viewer: AgentProfile): Promise<PropertyMedia> {
    const property = await this.findOwnedProperty(propertyId, viewer);
    const url = canonicalEmbedUrl(dto.url);
    if (!url) throw new BadRequestException('O link deve ser um vídeo válido do YouTube ou Vimeo.');
    const existing = await this.listForProperty(property.id);
    return this.media.save(this.media.create({
      propertyId: property.id, property, type: MediaType.VIDEO_EMBED, url,
      storageKey: null, orderIndex: existing.length, isCover: existing.length === 0,
    }));
  }

  async reorder(propertyId: string, dto: ReorderMediaDto, viewer: AgentProfile): Promise<PropertyMedia[]> {
    const property = await this.findOwnedProperty(propertyId, viewer);
    const existing = await this.listForProperty(property.id);
    const existingIds = new Set(existing.map((item) => item.id));
    const incomingIds = new Set(dto.mediaIds);
    if (incomingIds.size !== dto.mediaIds.length || incomingIds.size !== existingIds.size
      || dto.mediaIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException('A ordenação deve conter exatamente todas as mídias do imóvel uma única vez.');
    }
    const byId = new Map(existing.map((item) => [item.id, item]));
    const ordered = dto.mediaIds.map((id, orderIndex) => Object.assign(byId.get(id)!, { orderIndex }));
    return this.media.manager.transaction(async (manager) => manager.getRepository(PropertyMedia).save(ordered));
  }

  async setCover(propertyId: string, mediaId: string, viewer: AgentProfile): Promise<PropertyMedia> {
    const property = await this.findOwnedProperty(propertyId, viewer);
    return this.media.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PropertyMedia);
      const selected = await repository.findOne({ where: { id: mediaId, propertyId: property.id } });
      if (!selected) throw new NotFoundException('Mídia não encontrada.');
      await repository.update({ propertyId: property.id }, { isCover: false });
      selected.isCover = true;
      return repository.save(selected);
    });
  }

  async remove(propertyId: string, mediaId: string, viewer: AgentProfile): Promise<void> {
    const property = await this.findOwnedProperty(propertyId, viewer);
    const selected = await this.findMedia(property.id, mediaId);
    if (selected.storageKey) await this.deleteFromStorage(selected.storageKey);
    await this.media.remove(selected);
    if (selected.isCover) {
      const replacement = (await this.listForProperty(property.id))[0];
      if (replacement) {
        replacement.isCover = true;
        await this.media.save(replacement);
      }
    }
  }

  async listForProperty(propertyId: string): Promise<PropertyMedia[]> {
    return this.media.find({ where: { propertyId }, order: { orderIndex: 'ASC', id: 'ASC' } });
  }

  private async findOwnedProperty(id: string, viewer: AgentProfile): Promise<Property> {
    const restriction: FindOptionsWhere<Property> = viewer.role === AgentRole.ADMIN ? { id } : { id, agentId: viewer.id };
    const property = await this.properties.findOne({ where: restriction, relations: { agent: true } });
    if (!property) throw new NotFoundException('Imóvel não encontrado.');
    return property;
  }

  private async findMedia(propertyId: string, mediaId: string): Promise<PropertyMedia> {
    const item = await this.media.findOne({ where: { id: mediaId, propertyId } });
    if (!item) throw new NotFoundException('Mídia não encontrada.');
    return item;
  }

  private validateFile(file: UploadFile): { type: MediaType; extension: string } {
    const imageExtension = imageTypes.get(file.mimetype);
    if (imageExtension) {
      if (file.size > MAX_IMAGE_SIZE) throw new BadRequestException('Cada imagem deve ter no máximo 10 MB.');
      return { type: MediaType.IMAGE, extension: imageExtension };
    }
    const videoExtension = videoTypes.get(file.mimetype);
    if (videoExtension) {
      if (file.size > MAX_VIDEO_SIZE) throw new BadRequestException('Cada vídeo deve ter no máximo 30 MB.');
      return { type: MediaType.VIDEO_FILE, extension: videoExtension };
    }
    throw new BadRequestException('Tipo de mídia não suportado. Use JPEG, PNG, WebP, MP4 ou WebM.');
  }

  private publicUrl(key: string): string {
    return `${this.configuration.getOrThrow<string>('R2_PUBLIC_URL').replace(/\/$/, '')}/${key}`;
  }

  private deleteFromStorage(key: string): Promise<unknown> {
    return this.storage.send(new DeleteObjectCommand({ Bucket: 'corretor-midia', Key: key }));
  }
}
