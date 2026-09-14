import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';

const rootEnvironmentFile = resolve(import.meta.dirname, '../../../.env');

if (!process.env.DATABASE_URL && existsSync(rootEnvironmentFile)) {
  loadEnvFile(rootEnvironmentFile);
}

const prismaCli = resolve(import.meta.dirname, '../node_modules/prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});

process.exitCode = result.status ?? 1;
