/**
 * Lógica pura da fita horizontal da Roleta de Bolas (estilo PES myClub).
 *
 * NEUTRALIDADE (regra da spec 8.2): a fita é gerada com as MESMAS
 * probabilidades configuradas, de forma independente por posição — a bola do
 * resultado NÃO influencia a vizinhança. É proibido posicionar bolas
 * valiosas perto do resultado para criar sensação de "quase ganhei"; o
 * Modo Consciência explica esse viés ao jogador em vez de explorá-lo.
 *
 * O resultado continua vindo DIFERENCIADO do servidor (crypto.randomInt no
 * server) ANTES da animação; a fita apenas exibe. Nada aqui altera o
 * resultado — só escolhe em qual ocorrência da bola sorteada a fita para.
 */
import { BALLS, PROBABILITY_TOTAL, type Ball } from '@shared';

/** Diâmetro da bola em px (deve casar com --ball no CSS). */
export const BALL_PX = 96;
/** Espaço entre bolas. */
export const GAP_PX = 32;
/** Passo completo (bola + vão). */
export const STEP_PX = BALL_PX + GAP_PX;
/** Distância mínima do alvo em relação à posição atual (bolas). */
export const MIN_LEAD = 40;
/** Fases do movimento (segundos) — spec 8.3. */
export const ACCEL_S = 0.6;
export const CRUISE_S = 1.0;
export const DECEL_MIN_S = 4;
export const DECEL_MAX_S = 6;
/** Micro-ajuste final: a desaceleração termina GAP px antes e "assenta". */
export const SETTLE_GAP_PX = 0.8;
export const SETTLE_S = 0.18;

/** PRNG determinístico para a fita decorativa (testes reprodutíveis). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semente cosmética vinda de crypto (Math.random é proibido no projeto). */
export function cryptoSeed(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0];
}

/** Fonte sequencial de bolas da fita: sorteio independente por posição. */
export type BallSource = (index: number) => Ball;

export function makeBallSource(probabilities: Record<Ball, number>, seed: number): BallSource {
  const rng = mulberry32(seed);
  const cache = new Map<number, Ball>();
  let generated = 0;

  const drawOne = (): Ball => {
    const r = rng() * PROBABILITY_TOTAL;
    let acc = 0;
    for (const ball of BALLS) {
      acc += probabilities[ball];
      if (r < acc) return ball;
    }
    return BALLS[BALLS.length - 1];
  };

  return (index: number): Ball => {
    const cached = cache.get(index);
    if (cached !== undefined) return cached;
    while (generated <= index) {
      cache.set(generated, drawOne());
      generated += 1;
    }
    return cache.get(index)!;
  };
}

/** Centro horizontal do marcador (px). */
export function centerXOf(width: number): number {
  return width / 2;
}

/** Centro X (na tela) do centro da bola `index` para um deslocamento dado. */
export function positionOf(index: number, offset: number, centerX: number, step = STEP_PX): number {
  return index * step + step / 2 - offset;
}

/** Deslocamento em que a bola `index` fica exatamente centralizada. */
export function finalOffsetFor(index: number, centerX: number, step = STEP_PX): number {
  return index * step + step / 2 - centerX;
}

/** Índice da bola que está sob o marcador para um deslocamento dado. */
export function centerIndexAt(offset: number, centerX: number, step = STEP_PX): number {
  return Math.round((offset + centerX - step / 2) / step);
}

/**
 * Primeira ocorrência da bola do resultado a pelo menos `minLead` bolas à
 * frente do centro atual. A vizinhança NÃO é manipulada: a fita foi sorteada
 * de forma neutra antes (spec 8.2).
 */
export function findTargetIndex(
  source: BallSource,
  result: Ball,
  centerIndex: number,
  minLead = MIN_LEAD,
): number {
  const start = centerIndex + minLead;
  // Limites generosos: com a probabilidade mínima (2%) espera-se alvo em ~200.
  for (let i = start; i < start + 5000; i += 1) {
    if (source(i) === result) return i;
  }
  throw new Error('bola do resultado não encontrada na fita (fonte corrompida?)');
}

export interface SpinPlan {
  targetIndex: number;
  /** Distância total a percorrer em px até a posição exata do alvo. */
  distance: number;
  /** Duração da desaceleração (4–6 s). */
  decelS: number;
}

export function planSpin(
  source: BallSource,
  result: Ball,
  offsetStart: number,
  centerX: number,
  rng: () => number = mulberry32(cryptoSeed()),
): SpinPlan {
  const centerIndex = centerIndexAt(offsetStart, centerX);
  const targetIndex = findTargetIndex(source, result, centerIndex);
  const distance = finalOffsetFor(targetIndex, centerX) - offsetStart;
  if (distance <= 0) throw new Error('distância de giro inválida');
  const decelS = DECEL_MIN_S + rng() * (DECEL_MAX_S - DECEL_MIN_S);
  return { targetIndex, distance, decelS };
}

/**
 * Velocidade de cruzeiro para que a curva feche exatamente em `distance`:
 * d1 (aceleração, rampa linear) + d2 (cruzeiro) + d3 (easeOutQuart) = D.
 *   d1 = v·t1/2 ; d2 = v·t2 ; d3 = v·td/4  (derivada inicial do easeOutQuart)
 */
export function cruiseSpeed(distance: number, decelS: number): number {
  return distance / (ACCEL_S / 2 + CRUISE_S + decelS / 4);
}

/** Posição (px) no instante t — função analítica pura, testável. */
export function positionAtTime(t: number, distance: number, decelS: number): number {
  if (t <= 0) return 0;
  const v = cruiseSpeed(distance, decelS);
  const t1 = ACCEL_S;
  const t2 = t1 + CRUISE_S;
  const t3 = t2 + decelS;
  if (t <= t1) return (v * t * t) / (2 * t1); // rampa linear de velocidade
  const p1 = (v * t1) / 2;
  if (t <= t2) return p1 + v * (t - t1); // cruzeiro
  const p2 = p1 + v * (t2 - t1);
  if (t <= t3) {
    const x = (t - t2) / decelS;
    return p2 + ((v * decelS) / 4) * (1 - (1 - x) ** 4); // easeOutQuart
  }
  return distance;
}

export function totalSpinTime(decelS: number): number {
  return ACCEL_S + CRUISE_S + decelS;
}

/** Micro-ajuste final (assentamento suave, sem pular). */
export function settlePosition(progress: number, distance: number): number {
  const x = Math.min(1, Math.max(0, progress));
  return distance - SETTLE_GAP_PX + SETTLE_GAP_PX * (1 - (1 - x) ** 3);
}
