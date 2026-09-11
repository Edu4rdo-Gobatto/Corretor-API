import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Property } from '../properties/property.entity';

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO_EMBED = 'VIDEO_EMBED',
  VIDEO_FILE = 'VIDEO_FILE',
}

@Entity('property_media')
@Index('IDX_property_media_property_order', ['propertyId', 'orderIndex'])
export class PropertyMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId!: string;

  @ManyToOne(() => Property, (property) => property.media, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property!: Relation<Property>;

  @Column({ type: 'enum', enum: MediaType, enumName: 'MediaType' })
  type!: MediaType;

  @Column({ type: 'text' })
  url!: string;

  @Column({ name: 'storage_key', type: 'text', nullable: true })
  storageKey!: string | null;

  @Column({ name: 'order_index', type: 'integer', default: 0 })
  orderIndex!: number;

  @Column({ name: 'is_cover', type: 'boolean', default: false })
  isCover!: boolean;
}
