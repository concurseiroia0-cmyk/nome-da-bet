import '../config/index.js';
import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma compartilhado.
 * O DATABASE_URL (.env) aponta para SQLite local (arquivos em server/prisma/).
 */
export const prisma = new PrismaClient();
