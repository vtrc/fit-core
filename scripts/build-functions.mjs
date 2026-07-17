import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = resolve(root, 'functions');

const entries = readdirSync(functionsDir)
  .filter((name) => statSync(resolve(functionsDir, name)).isDirectory());

for (const name of entries) {
  const entryPoint = resolve(functionsDir, name, 'index.ts');
  const outfile = resolve(functionsDir, `${name}.ts`);

  try {
    statSync(entryPoint);
  } catch {
    console.error(`  ✕ ${name} — no index.ts found`);
    process.exit(1);
  }

  const cmd = [
    'npx', 'esbuild', entryPoint,
    '--bundle', '--platform=neutral', '--format=esm',
    '--external:npm:*',
    `--outfile=${outfile}`,
  ].join(' ');

  console.log(`  → ${name}`);
  execSync(cmd, { stdio: 'inherit' });
}
