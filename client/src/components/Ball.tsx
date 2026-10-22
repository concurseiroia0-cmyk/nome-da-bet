/**
 * Bola com arte original: esfera 3D em CSS (gradiente radial + brilho
 * especular) e emblema SVG próprio (estrela de 5 pontas) no centro.
 * Nenhum asset ou logo de terceiros.
 */
import type { Ball as BallName } from '@shared';

const STAR_PATH =
  'M12 2.6 L14.3 8.7 L20.9 9.1 L15.9 13.4 L17.5 19.9 L12 16.5 L6.5 19.9 L8.1 13.4 L3.1 9.1 L9.7 8.7 Z';

export function Ball({ ball, className }: { ball: BallName; className?: string }) {
  return (
    <div className={`ball b-${ball} ${className ?? ''}`} aria-hidden="true">
      <svg className="emblem" viewBox="0 0 24 24" focusable="false">
        <path d={STAR_PATH} fill="currentColor" />
      </svg>
    </div>
  );
}
