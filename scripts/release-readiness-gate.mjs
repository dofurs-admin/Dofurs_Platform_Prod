import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import yaml from 'js-yaml';

const checks = [
  { name: 'Typecheck', command: 'npx', args: ['tsc', '--noEmit'] },
  { name: 'Tests', command: 'npm', args: ['test'] },
  { name: 'Lint', command: 'npm', args: ['run', 'lint'] },
  { name: 'Schema health', command: 'npm', args: ['run', 'test:schema-health'] },
  { name: 'Service catalog sync-risk audit', command: 'npm', args: ['run', 'audit:service-catalog-sync', '--', '--fail-on-risk'] },
  { name: 'Build', command: 'npm', args: ['run', 'build'] },
];

for (const check of checks) {
  console.log(`\\n=== ${check.name} ===`);
  if (check.name === 'Build') {
    rmSync('.next', { recursive: true, force: true });
  }

  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`\\nRelease readiness gate failed at: ${check.name}`);
    process.exit(result.status ?? 1);
  }
}

// ── Render manifest sanity (D7′) ─────────────────────────────────────────────
// The deploy blueprint must parse and keep the expected service set before a
// release ships — catches env-var/secret drift and accidental service removal.
try {
  const renderManifest = yaml.load(readFileSync('infra/render.yaml', 'utf8'));
  const serviceNames = Array.isArray(renderManifest?.services)
    ? renderManifest.services.map((service) => service?.name).filter(Boolean)
    : [];
  const expectedServices = [
    'dofurs-single-page-website',
    'dofurs-billing-reminders-scheduler',
    'dofurs-cleanup-stale-transactions',
  ];
  const missing = expectedServices.filter((name) => !serviceNames.includes(name));

  if (missing.length > 0) {
    console.error(`\\nRender manifest check failed — missing services: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('\\n=== Render manifest ===');
  console.log(`infra/render.yaml OK (${serviceNames.length} services: ${serviceNames.join(', ')})`);
} catch (error) {
  console.error('\\nRender manifest check failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log('\\n=== Optional Performance Gate ===');
console.log('Run `npm run test:load:core` against staging with load-test auth tokens before public launch.');
console.log('Release readiness gate PASSED.');
