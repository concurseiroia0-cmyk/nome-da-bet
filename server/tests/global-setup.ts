/**
 * Setup global dos testes: cria/reset o banco SQLite de TESTES
 * (prisma/test.db) antes de toda a execução. O banco de desenvolvimento
 * (dev.db) nunca é tocado pelos testes.
 */
import { execSync } from 'node:child_process';

export const TEST_DATABASE_URL = 'file:./test.db?connection_limit=1';

export default function globalSetup(): void {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  execSync('npx prisma db push --skip-generate --force-reset', {
    stdio: 'inherit',
    env: { ...process.env },
  });
}
