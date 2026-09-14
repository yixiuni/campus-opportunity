import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../../../.env'),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const databaseUrl = parseEnv(readFileSync(candidate, 'utf8')).DATABASE_URL;
    if (databaseUrl) return databaseUrl;
  }

  throw new Error('DATABASE_URL is required. Copy .env.example to .env before starting the API.');
}
