/** Efeitos sonoros sintetizados (Web Audio) — sem arquivos externos. */
type SoundName = 'tick' | 'win' | 'big' | 'free' | 'loss';

let ctx: AudioContext | null = null;

function tone(freq: number, duration: number, opts: { delay?: number; type?: OscillatorType; volume?: number } = {}): void {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  const { delay = 0, type = 'sine', volume = 0.15 } = opts;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = ctx.currentTime + delay;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

/** Toca um efeito; retorna imediatamente. Silenciável pelo botão de som. */
export function playSound(name: SoundName, muted: boolean): void {
  if (muted) return;
  try {
    switch (name) {
      case 'tick':
        tone(880, 0.05, { type: 'square', volume: 0.05 });
        break;
      case 'win':
        tone(523, 0.15, { volume: 0.2 });
        tone(659, 0.18, { delay: 0.12, volume: 0.2 });
        tone(784, 0.25, { delay: 0.24, volume: 0.2 });
        break;
      case 'big':
        [523, 659, 784, 1046, 1318].forEach((f, i) =>
          tone(f, 0.3, { delay: i * 0.1, volume: 0.25, type: 'triangle' }),
        );
        break;
      case 'free':
        tone(392, 0.2, { volume: 0.2, type: 'triangle' });
        tone(587, 0.3, { delay: 0.18, volume: 0.2, type: 'triangle' });
        break;
      case 'loss':
        tone(220, 0.3, { volume: 0.15, type: 'sawtooth' });
        break;
    }
  } catch {
    // Áudio é opcional; falhas nunca quebram a jogada.
  }
}
