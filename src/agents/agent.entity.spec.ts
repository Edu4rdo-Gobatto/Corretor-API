import { DataSource } from 'typeorm';
import { createPostgresOptions } from '../config/database.config';
import { Agent } from './agent.entity';
import { Property } from '../properties/property.entity';
import { PropertyMedia } from '../media/property-media.entity';

class OfflinePostgresSource extends DataSource {
  async prepareMetadata(): Promise<void> {
    await this.buildMetadatas();
  }
}

describe('agent queries without connecting to PostgreSQL', () => {
  const source = new OfflinePostgresSource({
    ...createPostgresOptions('postgresql://test:password@ep-test.neon.tech/corretor?sslmode=require'),
    entities: [Agent, Property, PropertyMedia],
  });

  beforeAll(async () => { await source.prepareMetadata(); });

  it('does not select password hashes in ordinary profile queries', () => {
    const query = source.getRepository(Agent).createQueryBuilder('agent').getSql();
    expect(query).toContain('"email"');
    expect(query).not.toContain('password_hash');
    expect(source.isInitialized).toBe(false);
  });

  it('allows explicit password selection for credential verification', () => {
    const query = source.getRepository(Agent).createQueryBuilder('agent').addSelect('agent.passwordHash').getSql();
    expect(query).toContain('"password_hash"');
  });

  it('converts PostgreSQL decimals to JSON numbers and keeps nullable fees null', () => {
    const metadata = source.getMetadata(Property);
    const price = metadata.findColumnWithPropertyName('price')!;
    const fee = metadata.findColumnWithPropertyName('condoFee')!;
    expect(source.driver.prepareHydratedValue('12345.67', price)).toBe(12345.67);
    expect(source.driver.prepareHydratedValue(null, fee)).toBeNull();
  });
});
