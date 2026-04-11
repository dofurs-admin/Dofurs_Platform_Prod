#!/usr/bin/env node

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const migrationsDir = resolve(process.cwd(), 'infra/supabase/migrations');
const dbUrl = process.env.SUPABASE_DB_URL;
const mode = process.argv[2] ?? 'apply';

if (!dbUrl) {
  console.error('SUPABASE_DB_URL is required.');
  process.exit(1);
}

const psqlVersion = spawnSync('psql', ['--version'], { encoding: 'utf8' });
if (psqlVersion.status !== 0) {
  console.error('psql is required to run migrations. Install PostgreSQL client tools and retry.');
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => ({ name, path: join(migrationsDir, name) }))
  .filter(({ path }) => statSync(path).isFile())
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

function runPsql(args, input) {
  const result = spawnSync('psql', [dbUrl, ...args], {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'Unknown psql error';
    throw new Error(stderr);
  }

  return (result.stdout ?? '').trim();
}

function escapeLiteral(value) {
  return value.replace(/'/g, "''");
}

try {
  runPsql(
    [
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
    ],
  );

  if (mode === 'status') {
    let pendingCount = 0;

    for (const file of files) {
      const exists = runPsql(
        ['-tA', '-c', `SELECT 1 FROM schema_migrations WHERE filename = '${escapeLiteral(file.name)}' LIMIT 1;`],
      );
      const applied = exists === '1';
      if (!applied) pendingCount += 1;
      console.log(`${applied ? 'applied' : 'pending'}\t${file.name}`);
    }

    console.log(`\nTotal: ${files.length} | Pending: ${pendingCount}`);
    process.exit(0);
  }

  for (const file of files) {
    const exists = runPsql(
      ['-tA', '-c', `SELECT 1 FROM schema_migrations WHERE filename = '${escapeLiteral(file.name)}' LIMIT 1;`],
    );

    if (exists === '1') {
      console.log(`skip\t${file.name}`);
      continue;
    }

    console.log(`apply\t${file.name}`);
    runPsql(['-v', 'ON_ERROR_STOP=1', '-f', file.path]);
    runPsql(
      [
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        `INSERT INTO schema_migrations (filename) VALUES ('${escapeLiteral(file.name)}') ON CONFLICT (filename) DO NOTHING;`,
      ],
    );
  }

  console.log('Migration run completed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
