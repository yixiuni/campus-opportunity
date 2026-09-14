import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export function readEnvironment(name: string): string | undefined {
  if (process.env[name] !== undefined) return process.env[name];
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../../../.env'),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const value = parseEnv(readFileSync(candidate, 'utf8'))[name];
    if (value !== undefined) return value;
  }
}

export function loadDatabaseUrl(): string {
  const databaseUrl = readEnvironment('DATABASE_URL');
  if (databaseUrl) return databaseUrl;
  throw new Error('DATABASE_URL is required. Copy .env.example to .env before starting the API.');
}
