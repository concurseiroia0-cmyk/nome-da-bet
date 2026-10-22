/**
 * Roda da Roleta de Bolas.
 *
 * As bolas giram em círculo: aceleram e depois desaceleram gradualmente até
 * parar na bola do resultado — que JÁ veio sorteada do servidor. Este componente
 * apenas exibe; ele nunca influencia o resultado.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BALLS, BALL_LABEL, type Ball } from '@shared';

const SLOT_COUNT = 15;
const STEP = 360 / SLOT_COUNT;
/** Índice do slot onde a bola vencedora é renderizada (fica no topo no fim). */
const WINNER_SLOT = 3;

interface Props {
  /** Resultado já sorteado pelo servidor; null = repouso. */
  result: Ball | null;
  /** Muda a cada giro para reiniciar a animação. */
  spinNonce: number;
  /** true = modo "reduzir animações". */
  reduced: boolean;
  /** Chamado quando a roda termina de desacelerar. */
  onSettled: () => void;
}

export function RouletteWheel({ result, spinNonce, reduced, onSettled }: Props) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [winnerVisible, setWinnerVisible] = useState(false);
  const rotationRef = useRef(0);

  // Lido via ref: o efeito de rotação roda SOMENTE quando spinNonce muda.
  const resultRef = useRef(result);
  resultRef.current = result;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Slots decorativos: resultado no slot vencedor, resto em ciclo fixo.
  const slots = useMemo(() => {
    const current = resultRef.current;
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      if (i === WINNER_SLOT && current) return current;
      return BALLS[(i + 1) % BALLS.length];
    });
  }, [result, spinNonce]);

  useEffect(() => {
    if (spinNonce === 0) return;
    const el = wheelRef.current;
    if (!el) return;
    const reducedMotion = reducedRef.current;
    setWinnerVisible(false);

    const start = rotationRef.current;
    // Gira 5 voltas + o ângulo necessário para alinhar o slot vencedor no topo
    // (slot 0 está no topo quando a roda está em 0°; winner no topo = -(WINNER_SLOT*STEP)).
    const targetMod = ((-(WINNER_SLOT * STEP) % 360) + 360) % 360;
    const currentMod = ((start % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta < 0) delta += 360;
    const target = start + 5 * 360 + delta;

    const duration = reducedMotion ? 250 : 3800;
    const t0 = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      // Acelera no início e desacelera gradualmente no fim.
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const angle = start + (target - start) * eased;
      rotationRef.current = angle;
      el.style.transform = `rotate(${angle}deg)`;
      if (p < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        setWinnerVisible(true);
        onSettled();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // O resultado é lido via ref: só o nonce dispara a rotação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinNonce, onSettled]);

  return (
    <div className="wheel" ref={wheelRef} aria-hidden="true">
      <div className="wheel-pointer" />
      {slots.map((ball, i) => {
        const isWinner = i === WINNER_SLOT && winnerVisible;
        const angle = i * STEP;
        return (
          <div
            key={i}
            className={`wheel-ball ${ball}${isWinner ? ' winner' : ''}`}
            style={{ transform: `rotate(${angle}deg) translateY(calc(var(--wheel-r) * -1)) rotate(${-angle}deg)` }}
            title={BALL_LABEL[ball]}
          />
        );
      })}
      <div className="wheel-center">
        <span className="gold" style={{ fontWeight: 900 }}>
          ROLETA
        </span>
        <span>de Bolas</span>
      </div>
    </div>
  );
}

/** Camada de partículas douradas exibida sobre o palco quando a bola vence. */
export function WinnerParticles({ intensity }: { intensity: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: intensity }, (_, i) => {
        const a = (i / intensity) * Math.PI * 2;
        const dist = 90 + (i % 5) * 26;
        return {
          key: i,
          dx: `${Math.cos(a) * dist}px`,
          dy: `${Math.sin(a) * dist}px`,
          color: i % 3 === 0 ? '#fff' : i % 3 === 1 ? '#FFD700' : '#ffe44d',
        };
      }),
    [intensity],
  );
  return (
    <div className="particles">
      {particles.map((p) => (
        <span
          key={p.key}
          className="particle"
          style={{ background: p.color, ['--dx' as string]: p.dx, ['--dy' as string]: p.dy }}
        />
      ))}
    </div>
  );
}
