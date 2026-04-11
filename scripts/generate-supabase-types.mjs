#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '.env.local'));

const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_TOKEN;
if (token) {
  process.env.SUPABASE_ACCESS_TOKEN = token;
}

const projectId = process.env.SUPABASE_PROJECT_ID;
const outputPath = resolve(process.cwd(), 'lib/supabase/database.types.ts');

if (!projectId) {
  console.error('SUPABASE_PROJECT_ID is required (env or .env/.env.local).');
  process.exit(1);
}

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is required (env or .env/.env.local).');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', projectId, '--schema', 'public'],
  { encoding: 'utf8' },
);

if (result.status !== 0) {
  console.error(result.stderr?.trim() || 'Failed to generate Supabase types.');
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, result.stdout, 'utf8');
console.log(`Generated ${outputPath}`);
