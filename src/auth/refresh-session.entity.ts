import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('refresh_sessions')
export class RefreshSession {
  @PrimaryColumn({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
