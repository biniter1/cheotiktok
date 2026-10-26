import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './lib/db.js';

/**
 * Migration runner an toàn khi chạy nhiều bản cùng lúc (HA):
 * advisory lock đảm bảo chỉ một process áp migration.
 */
const LOCK_ID = 724301;

async function main() {
  const dir = path.resolve(process.cwd(), 'migrations');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const c = await pool.connect();
  try {
    await c.query('select pg_advisory_lock($1)', [LOCK_ID]);
    await c.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    const { rows } = await c.query<{ name: string }>('select name from schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await fs.readFile(path.join(dir, f), 'utf8');
      await c.query('BEGIN');
      try {
        await c.query(sql);
        await c.query('insert into schema_migrations(name) values ($1)', [f]);
        await c.query('COMMIT');
        console.log(`applied ${f}`);
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await c.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
