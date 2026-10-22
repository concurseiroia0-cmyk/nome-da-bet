/**
 * Registro de jogos do lobby.
 *
 * Para adicionar um novo jogo (ex.: slot "Tigrinho"):
 *  1. crie a pasta do módulo em src/games/<novo-jogo>/ (recomenda-se copiar a
 *     estrutura de ball-roulette: draw/rtp/round-resolver/engine/simulation);
 *  2. adicione a entrada aqui com status 'available';
 *  3. registre as rotas da API em src/app.ts (se o jogo tiver endpoints próprios);
 *  4. no client, troque o card "Em breve" pelo link da página do jogo.
 * Veja docs/ADICIONAR-JOGO.md para o passo a passo completo.
 */
export type GameStatus = 'available' | 'coming-soon';

export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  status: GameStatus;
  /** Rota da página do jogo no client (para status 'available'). */
  path?: string;
}

export const gameRegistry: GameDefinition[] = [
  {
    id: 'ball-roulette',
    name: 'Roleta de Bolas',
    description:
      'Gire e acerte a bola: branca zera, bronze dá tentativa grátis, prata 1.5x, dourada 2x e preta 10x.',
    status: 'available',
    path: '/jogo/ball-roulette',
  },
  {
    id: 'tigrinho',
    name: 'Tigrinho',
    description: 'Slot clássico com giros e multiplicadores. Em breve!',
    status: 'coming-soon',
  },
  {
    id: 'crash',
    name: 'Crash',
    description: 'Cash out antes do multiplicador explodir. Em breve!',
    status: 'coming-soon',
  },
  {
    id: 'mines',
    name: 'Mines',
    description: 'Evite as minas e acumule prêmios. Em breve!',
    status: 'coming-soon',
  },
];

export function listGames(): GameDefinition[] {
  return gameRegistry.map((game) => ({ ...game }));
}

export function getGame(id: string): GameDefinition | undefined {
  return gameRegistry.find((game) => game.id === id);
}
