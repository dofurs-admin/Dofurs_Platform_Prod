import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const checks = [
  { name: 'Typecheck', command: 'npx', args: ['tsc', '--noEmit'] },
  { name: 'Tests', command: 'npm', args: ['test'] },
  { name: 'Schema health', command: 'npm', args: ['run', 'test:schema-health'] },
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

console.log('\\n=== Optional Performance Gate ===');
console.log('Run `npm run test:load:core` against staging with load-test auth tokens before public launch.');
console.log('Release readiness gate PASSED.');
