#!/usr/bin/env node
/**
 * Roda no postinstall: um clone novo não tem server/.env e o Prisma falha
 * sem DATABASE_URL. Copia .env.example -> .env quando não existir.
 */
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, '../server/.env');
const examplePath = path.resolve(here, '../server/.env.example');

if (!existsSync(envPath) && existsSync(examplePath)) {
  copyFileSync(examplePath, envPath);
  console.log('[setup] server/.env criado a partir de .env.example (valores de demonstração).');
}
