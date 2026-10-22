/**
 * Setup executado antes de cada arquivo de teste (mesmo processo dos testes):
 * aponta o Prisma para o banco de testes e isola as variáveis de ambiente.
 */
process.env.DATABASE_URL = 'file:./test.db?connection_limit=1';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
// Rate limit alto para não interferir nos testes de fluxo.
process.env.RATE_LIMIT_MAX = '1000000';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RTP_TOLERANCE = '0.01';
process.env.NODE_ENV = 'test';
