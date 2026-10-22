/** Partículas douradas exibidas sobre o marcador quando a bola vence. */
import { useMemo } from 'react';

export function WinnerParticles({ intensity }: { intensity: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: intensity }, (_, i) => {
        const a = (i / intensity) * Math.PI * 2;
        const dist = 80 + (i % 5) * 26;
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
    <div className="particles" aria-hidden="true">
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
