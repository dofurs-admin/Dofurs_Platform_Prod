#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function printUsage() {
  console.log('Usage: node scripts/mobile-bearer-smoke-clipboard.mjs [--base-url <url>]');
  console.log('Reads a Supabase user access token from macOS clipboard (pbpaste), validates it, then runs mobile-bearer-smoke.mjs.');
}

function parseArgs(argv) {
  const parsed = {
    baseUrl: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--base-url') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --base-url');
      }

      parsed.baseUrl = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--base-url=')) {
      parsed.baseUrl = arg.slice('--base-url='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function readClipboardToken() {
  try {
    return execFileSync('pbpaste', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('Unable to read clipboard via pbpaste. This helper currently supports macOS terminals.');
  }
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 3) {
    throw new Error('Clipboard value is not a JWT (expected 3 dot-separated parts).');
  }

  const payloadPart = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payloadPart + '='.repeat((4 - (payloadPart.length % 4)) % 4);
  const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));

  return payload;
}

function validateToken(token) {
  if (!token) {
    throw new Error('Clipboard is empty. Copy your website user access_token first.');
  }

  if (!token.startsWith('eyJ')) {
    throw new Error('Clipboard token does not look like a Supabase user JWT (expected to start with eyJ).');
  }

  const payload = decodeJwtPayload(token);
  if (!payload.sub) {
    throw new Error('JWT payload is missing sub claim. Copy a USER session access_token, not project credentials.');
  }

  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT is expired. Re-login on website and copy a fresh access_token.');
  }
}

function runSmoke(baseUrl, token) {
  const currentFilePath = fileURLToPath(import.meta.url);
  const scriptPath = path.resolve(path.dirname(currentFilePath), 'mobile-bearer-smoke.mjs');

  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DOFURS_MOBILE_API_BASE_URL: baseUrl,
      DOFURS_MOBILE_BEARER_TOKEN: token,
    },
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const baseUrl = (args.baseUrl || process.env.DOFURS_MOBILE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const token = readClipboardToken();

  validateToken(token);

  console.log('Clipboard token validation: OK');
  console.log(`Base URL: ${baseUrl}`);
  runSmoke(baseUrl, token);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
