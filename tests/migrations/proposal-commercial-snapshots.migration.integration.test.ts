import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const targetMigration = '20260922000001_add_proposal_commercial_snapshots';

describe.runIf(Boolean(migrationDatabaseUrl))('proposal commercial snapshots migration', () => {
  const client = new Client({ connectionString: migrationDatabaseUrl });

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('applies through the snapshot migration with stable distinct indexes', async () => {
    const migrationsPath = path.resolve('prisma/migrations');
    const migrationNames = (await readdir(migrationsPath))
      .filter((name) => name <= targetMigration)
      .sort();

    for (const migrationName of migrationNames) {
      const sql = await readFile(path.join(migrationsPath, migrationName, 'migration.sql'), 'utf8');
      await client.query(sql);
    }

    const tables = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('ProposalMenuSelection', 'ProposalPaymentMethod')
      ORDER BY table_name
    `);
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      'ProposalMenuSelection',
      'ProposalPaymentMethod'
    ]);

    const snapshotColumns = await client.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Proposal'
        AND column_name IN ('responsibleNameSnapshot', 'responsibleTitleSnapshot')
      ORDER BY column_name
    `);
    expect(snapshotColumns.rows.map(({ column_name }) => column_name)).toEqual([
      'responsibleNameSnapshot',
      'responsibleTitleSnapshot'
    ]);

    const indexes = await client.query<{ index_name: string; is_unique: boolean }>(`
      SELECT index_class.relname AS index_name, index_meta.indisunique AS is_unique
      FROM pg_class AS table_class
      JOIN pg_index AS index_meta ON index_meta.indrelid = table_class.oid
      JOIN pg_class AS index_class ON index_class.oid = index_meta.indexrelid
      WHERE table_class.relnamespace = 'public'::regnamespace
        AND table_class.relname = 'ProposalMenuSelection'
        AND index_class.relname IN (
          'ProposalMenuSelection_order_idx',
          'ProposalMenuSelection_order_key'
        )
      ORDER BY index_class.relname
    `);
    expect(indexes.rows).toEqual([
      { index_name: 'ProposalMenuSelection_order_idx', is_unique: false },
      { index_name: 'ProposalMenuSelection_order_key', is_unique: true }
    ]);
  });
});
