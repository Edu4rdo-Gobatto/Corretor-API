import { randomUUID } from 'node:crypto';
import { DeepPartial, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { MediaType, PropertyMedia } from '../media/property-media.entity';

export class MediaRepositoryFixture {
  readonly media = new Map<string, PropertyMedia>();
  failSave = false;

  create(fields: DeepPartial<PropertyMedia>): PropertyMedia {
    return Object.assign(new PropertyMedia(), {
      id: randomUUID(), type: MediaType.IMAGE, storageKey: null, orderIndex: 0, isCover: false,
    }, fields);
  }

  save(value: PropertyMedia | PropertyMedia[]): Promise<PropertyMedia | PropertyMedia[]> {
    if (this.failSave) throw new Error('database unavailable');
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => this.media.set(item.id, item));
    return Promise.resolve(Array.isArray(value) ? values : values[0]);
  }

  remove(item: PropertyMedia): Promise<PropertyMedia> {
    this.media.delete(item.id);
    return Promise.resolve(item);
  }

  findOne(options: FindOneOptions<PropertyMedia>): Promise<PropertyMedia | null> {
    return Promise.resolve(this.filtered(options.where as FindOptionsWhere<PropertyMedia>)[0] ?? null);
  }

  find(options: FindManyOptions<PropertyMedia>): Promise<PropertyMedia[]> {
    const result = this.filtered(options.where as FindOptionsWhere<PropertyMedia>);
    result.sort((first, second) => first.orderIndex - second.orderIndex || first.id.localeCompare(second.id));
    return Promise.resolve(result);
  }

  private filtered(where: FindOptionsWhere<PropertyMedia>): PropertyMedia[] {
    return [...this.media.values()].filter((item) => Object.entries(where).every(([key, value]) => item[key as keyof PropertyMedia] === value));
  }
}
