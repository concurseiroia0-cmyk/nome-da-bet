/**
 * Módulo do jogo "Roleta de Bolas".
 *
 * Todo o comportamento do jogo fica isolado aqui. Novos jogos (ex.: slot
 * "Tigrinho") ganham uma pasta própria em ../<novo-jogo> e entram no lobby
 * pelo registry (../registry.ts), sem tocar no restante da API.
 */
export * from './draw.js';
export * from './rtp.js';
export * from './config-validation.js';
export * from './round-resolver.js';
export * from './engine.js';
export * from './simulation.js';
