/**
 * Palco da Roleta de Bolas HORIZONTAL (spec 8.1–8.3).
 *
 * - Fita circular infinita da direita para a esquerda, marcador fixo no
 *   centro (anel luminoso com mira), bola central em destaque e cenário de
 *   estádio escuro com holofote (arte própria, sem assets de terceiros).
 * - O resultado JÁ vem sorteado do servidor; aqui só animamos até parar
 *   exatamente sobre uma ocorrência dessa bola (≥ 40 bolas de distância).
 * - A fita é neutra (probabilidades configuradas, sorteio independente por
 *   posição) — vizinhança NUNCA é manipulada.
 * - Movimento só com transform/translate3d (60 fps, sem reflow).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BALL_HEX, type Ball, type RouletteConfigDTO } from '@shared';
import {
  BALL_PX,
  SETTLE_GAP_PX,
  SETTLE_S,
  STEP_PX,
  centerXOf,
  centerIndexAt,
  cryptoSeed,
  makeBallSource,
  mulberry32,
  planSpin,
  positionAtTime,
  positionOf,
  settlePosition,
  totalSpinTime,
} from '../games/roulette/tape.ts';

const STAR_PATH =
  'M12 2.6 L14.3 8.7 L20.9 9.1 L15.9 13.4 L17.5 19.9 L12 16.5 L6.5 19.9 L8.1 13.4 L3.1 9.1 L9.7 8.7 Z';

interface Props {
  /** Bola do resultado (servidor); null = repouso. */
  result: Ball | null;
  /** Muda a cada giro para reiniciar a animação. */
  spinNonce: number;
  /** Modo "reduzir animações": troca o movimento por um fade curto. */
  reduced: boolean;
  /** Probabilidades configuradas (mesmas do servidor) para a fita neutra. */
  config: RouletteConfigDTO | null;
  /** Chamado quando a fita termina (inclusive no modo reduzido). */
  onSettled: () => void;
  /** Chamado a cada bola que cruza o marcador (tick sonoro). */
  onTick?: () => void;
}

interface Slot {
  wrap: HTMLDivElement;
  inner: HTMLDivElement;
  index: number | null;
}

export function TapeRoulette({ result, spinNonce, reduced, config, onSettled, onTick }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<Slot[]>([]);
  const offsetRef = useRef(0);
  const widthRef = useRef(0);
  const centerIdxRef = useRef<number | null>(null);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const tickRef = useRef(onTick);
  tickRef.current = onTick;
  const [slotCount, setSlotCount] = useState(9);
  const [winner, setWinner] = useState(false);

  // Fonte de bolas da fita (semente nova se a configuração mudar).
  const probsKey = config ? JSON.stringify(config.probabilities) : '';
  const source = useMemo(
    () => (config ? makeBallSource(config.probabilities, cryptoSeed()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [probsKey],
  );

  /** Marca a bola sob o marcador como vencedora (brilho + escala extra). */
  const markWinner = useCallback((on: boolean) => {
    for (const slot of slotsRef.current) {
      if (!slot) continue;
      if (slot.index === centerIdxRef.current) {
        slot.inner.classList.toggle('winner', on);
      }
    }
  }, []);

  const paint = useCallback((offset: number) => {
    const width = widthRef.current;
    const centerX = centerXOf(width);
    const first = Math.floor(offset / STEP_PX);
    for (let j = 0; j < slotsRef.current.length; j += 1) {
      const slot = slotsRef.current[j];
      if (!slot) continue;
      const index = first + j;
      const x = positionOf(index, offset, centerX);
      if (x < -STEP_PX || x > width + STEP_PX) {
        slot.wrap.style.visibility = 'hidden';
        continue;
      }
      slot.wrap.style.visibility = 'visible';
      slot.wrap.style.transform = `translate3d(${x - BALL_PX / 2}px, 0, 0)`;
      if (slot.index !== index && source) {
        slot.index = index;
        slot.inner.className = `ball b-${source(index)}`;
      }
    }
    // Bola sob o marcador: destaque, escala e transição de cor do cenário.
    const cIdx = centerIndexAt(offset, centerX);
    if (cIdx !== centerIdxRef.current) {
      centerIdxRef.current = cIdx;
      for (const slot of slotsRef.current) {
        if (!slot) continue;
        if (slot.index === cIdx) {
          slot.inner.classList.add('center');
          const stage = stageRef.current;
          if (stage && source) stage.style.setProperty('--tint', BALL_HEX[source(cIdx)]);
        } else {
          slot.inner.classList.remove('center');
        }
      }
    }
  }, [source]);

  // Tamanho da janela visível (reciclagem dos elementos que saem da tela).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      widthRef.current = stage.clientWidth;
      setSlotCount(Math.max(6, Math.ceil(widthRef.current / STEP_PX) + 2));
      paint(offsetRef.current);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [paint]);

  // Animação do giro: acelera, cruzeiro e desacelera até o alvo exato.
  useEffect(() => {
    if (spinNonce === 0 || !result || !config || !source) return;
    const stage = stageRef.current;
    if (!stage) return;

    const offsetStart = offsetRef.current;
    const plan = planSpin(source, result, offsetStart, centerXOf(widthRef.current), mulberry32(cryptoSeed()));
    const decelDistance = plan.distance - SETTLE_GAP_PX;
    setWinner(false);

    if (reduced) {
      // Modo reduzido: sem movimento — troca por fade curto até o alvo.
      offsetRef.current = offsetStart + plan.distance;
      paint(offsetRef.current);
      stage.classList.add('fading');
      const t = window.setTimeout(() => {
        stage.classList.remove('fading');
        markWinner(true);
        setWinner(true);
        settledRef.current();
      }, SETTLE_S * 1000 + 120);
      return () => window.clearTimeout(t);
    }

    let raf = 0;
    let lastCross = Math.floor(offsetStart / STEP_PX);
    const t0 = performance.now();
    const totalTime = totalSpinTime(plan.decelS);

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      let offset: number;
      if (t < totalTime) {
        offset = offsetStart + positionAtTime(t, decelDistance, plan.decelS);
      } else {
        const settleT = t - totalTime;
        if (settleT < SETTLE_S) {
          offset = offsetStart + settlePosition(settleT / SETTLE_S, plan.distance);
        } else {
          offset = offsetStart + plan.distance; // exatamente sobre a bola sorteada
          paint(offset);
          offsetRef.current = offset;
          markWinner(true);
          setWinner(true);
          settledRef.current();
          return;
        }
      }
      offsetRef.current = offset;
      paint(offset);
      // Tick a cada bola que cruza o marcador (o intervalo cresce sozinho
      // conforme a desaceleração reduz a velocidade).
      const cross = Math.floor(offset / STEP_PX);
      if (cross !== lastCross) {
        lastCross = cross;
        tickRef.current?.();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spinNonce, result, config, source, reduced, paint, markWinner]);

  // Vibração leve opcional no mobile quando a bola vencedora trava.
  useEffect(() => {
    if (winner && !reduced && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(18);
      } catch {
        // opcional; nunca quebra
      }
    }
  }, [winner, reduced]);

  return (
    <div className="stage" ref={stageRef} aria-hidden="true">
      <div className="stage-scenario" />
      <div className="stage-tint" />
      <div className="stage-silhouette" />
      <div className="tape">
        {Array.from({ length: slotCount }, (_, j) => (
          <div
            key={j}
            className="ball-slot"
            ref={(el) => {
              if (el && !slotsRef.current[j]) {
                slotsRef.current[j] = { wrap: el, inner: el.firstElementChild as HTMLDivElement, index: null };
              } else if (!el) {
                delete slotsRef.current[j];
              }
            }}
          >
            <div className="ball">
              <svg className="emblem" viewBox="0 0 24 24" focusable="false">
                <path d={STAR_PATH} fill="currentColor" />
              </svg>
            </div>
          </div>
        ))}
        <div className="marker">
          <span className="m m-n" />
          <span className="m m-s" />
          <span className="m m-e" />
          <span className="m m-w" />
        </div>
      </div>
      <div className="stage-vignette" />
    </div>
  );
}
