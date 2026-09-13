import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateRentalAdministration1789257600000 implements MigrationInterface {
  name = 'CreateRentalAdministration1789257600000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE rental_parties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('OWNER','TENANT')),
      person_type text NOT NULL CHECK (person_type IN ('PF','PJ')), name text NOT NULL, private_data text NOT NULL,
      active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query('CREATE INDEX "IDX_rental_parties_kind_name" ON rental_parties (kind, name, id)');
    await runner.query(`CREATE TABLE leases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text NOT NULL UNIQUE,
      property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
      owner_id uuid NOT NULL REFERENCES rental_parties(id) ON DELETE RESTRICT,
      tenant_id uuid NOT NULL REFERENCES rental_parties(id) ON DELETE RESTRICT,
      start_date date NOT NULL, end_date date NOT NULL, rent_amount numeric(12,2) NOT NULL CHECK (rent_amount > 0),
      due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 31), status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','ENDED')),
      notes text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_leases_dates" CHECK (end_date >= start_date), CONSTRAINT "CHK_leases_parties" CHECK (owner_id <> tenant_id)
    )`);
    await runner.query(`CREATE UNIQUE INDEX "IDX_leases_one_active_property" ON leases (property_id) WHERE status = 'ACTIVE'`);
    await runner.query('CREATE INDEX "IDX_leases_owner" ON leases (owner_id)');
    await runner.query('CREATE INDEX "IDX_leases_tenant" ON leases (tenant_id)');
    await runner.query('CREATE INDEX "IDX_leases_property" ON leases (property_id)');
    await runner.query(`CREATE TABLE rental_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), party_id uuid REFERENCES rental_parties(id) ON DELETE RESTRICT,
      lease_id uuid REFERENCES leases(id) ON DELETE RESTRICT, file_name text NOT NULL,
      content_type text NOT NULL CHECK (content_type IN ('application/pdf','image/jpeg','image/png')),
      size integer NOT NULL CHECK (size > 0 AND size <= 10485760), storage_key text NOT NULL UNIQUE,
      bucket text NOT NULL CHECK (bucket <> 'corretor-midia'), created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_rental_documents_parent" CHECK ((party_id IS NULL) <> (lease_id IS NULL))
    )`);
    await runner.query('CREATE INDEX "IDX_rental_documents_party" ON rental_documents (party_id)');
    await runner.query('CREATE INDEX "IDX_rental_documents_lease" ON rental_documents (lease_id)');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE rental_documents');
    await runner.query('DROP TABLE leases');
    await runner.query('DROP TABLE rental_parties');
  }
}
