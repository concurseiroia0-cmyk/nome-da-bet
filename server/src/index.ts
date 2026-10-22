/** Ponto de entrada do servidor da DEMO (créditos fictícios, sem valor real). */
import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[NOME DA BET] API de DEMO rodando em http://localhost:${config.port}`);
  console.log('Ambiente de teste: créditos fictícios sem valor real.');
});

function shutdown(signal: string) {
  console.log(`[server] ${signal} recebido, encerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
