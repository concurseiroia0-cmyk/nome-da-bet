/**
 * Página da Roleta de Bolas HORIZONTAL (spec 8).
 *
 * O resultado JÁ vem sorteado do servidor; aqui só animamos e exibimos. O
 * botão GIRAR fica desabilitado durante toda a animação — inclusive a
 * tentativa grátis automática. O Modo Consciência (educativo) mostra as
 * técnicas de design e os números reais da sessão.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BALLS,
  BALL_LABEL,
  CENTS_PER_CREDIT,
  type Ball,
  type RouletteConfigDTO,
  type RoundStepDTO,
} from '@shared';
import { api, ApiError } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { TapeRoulette } from '../components/TapeRoulette.tsx';
import { WinnerParticles } from '../components/Particles.tsx';
import { ConsciencePanel, type SessionStats } from '../components/ConsciencePanel.tsx';
import { playSound } from '../sound.ts';
import { formatCredits, formatMultiplier, formatPercent, formatRtp, newIdempotencyKey } from '../utils.ts';

type Phase = 'idle' | 'spinning' | 'free-spin-intro' | 'revealing';

interface RevealState {
  step: RoundStepDTO;
  showParticles: boolean;
  isBlackFlash: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function RoulettePage() {
  const { user, refresh } = useAuth();
  const [config, setConfig] = useState<RouletteConfigDTO | null>(null);
  const [bet, setBet] = useState<number>(100);
  const [phase, setPhase] = useState<Phase>('idle');
  const [spinNonce, setSpinNonce] = useState(0);
  const [revel, setRevel] = useState<RevealState | null>(null);
  const [recent, setRecent] = useState<RoundStepDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [conscience, setConscience] = useState(false);
  const [session, setSession] = useState<SessionStats>({
    totalBet: 0,
    totalPaid: 0,
    rounds: 0,
    startedAt: Date.now(),
  });
  const [chartHistory, setChartHistory] = useState<RoundStepDTO[]>([]);
  const settledResolver = useRef<(() => void) | null>(null);
  const busy = phase !== 'idle';

  const reduced = reduceMotion;

  useEffect(() => {
    api.rouletteConfig().then(setConfig).catch(() => setConfig(null));
    void loadRecent();
  }, []);

  async function loadRecent() {
    try {
      const r = await api.recentRounds(10);
      setRecent(r.items);
    } catch {
      // histórico é opcional na tela
    }
  }

  const loadChart = useCallback(async () => {
    try {
      const r = await api.history(1, 100);
      setChartHistory(r.items);
    } catch {
      // gráfico é opcional
    }
  }, []);

  useEffect(() => {
    if (conscience) void loadChart();
  }, [conscience, loadChart]);

  const waitSettled = () => new Promise<void>((r) => (settledResolver.current = r));
  const handleSettled = useCallback(() => {
    settledResolver.current?.();
    settledResolver.current = null;
  }, []);

  async function animateStep(step: RoundStepDTO, isFirstStep: boolean) {
    // Resultado vem do servidor; animação apenas o exibe. O resultado é
    // definido ANTES de a fita girar (mesmo batch de estado).
    setRevel({ step, showParticles: false, isBlackFlash: false });
    setSpinNonce((n) => n + 1);
    const settled = waitSettled();
    if (isFirstStep) {
      setSession((s) => ({ ...s, rounds: s.rounds + 1, totalBet: s.totalBet + step.bet }));
    }
    setSession((s) => ({ ...s, totalPaid: s.totalPaid + step.payout }));
    await settled;

    const isBlack = step.ball === 'preta';
    const isBronze = step.ball === 'bronze';
    const isWin = step.payout > 0;

    setRevel({ step, showParticles: isWin && !reduced, isBlackFlash: isBlack && !reduced });
    if (isBlack) playSound('big', muted);
    else if (isBronze) playSound('free', muted);
    else if (isWin) playSound('win', muted);
    else playSound('loss', muted);

    await sleep(reduced ? 350 : isBlack ? 2400 : isWin || isBronze ? 1600 : 1000);
  }

  async function onSpin() {
    if (busy || !config || !user) return;
    setError(null);

    if (bet < config.minBet || bet > config.maxBet) {
      setError(`Aposta deve estar entre ${formatCredits(config.minBet)} e ${formatCredits(config.maxBet)} créditos.`);
      return;
    }
    if (bet > user.balance) {
      setError('Saldo insuficiente para esta aposta.');
      return;
    }

    setPhase('spinning');
    try {
      const res = await api.spin(bet, newIdempotencyKey());

      // Etapa 1 (paga)
      await animateStep(res.steps[0], true);

      // Etapa 2: tentativa grátis (mesma transação no servidor)
      if (res.steps.length > 1) {
        setPhase('free-spin-intro');
        await sleep(reduced ? 400 : 1500);
        setRevel(null);
        setPhase('spinning');
        await animateStep(res.steps[1], false);
      }

      setPhase('revealing');
      await sleep(reduced ? 300 : 900);
      await Promise.all([refresh(), loadRecent()]);
      if (conscience) await loadChart();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao girar.');
      await refresh();
    } finally {
      setPhase('idle');
      setRevel(null);
    }
  }

  const lastBall = recent[0]?.ball ?? null;
  const multiplierOf = (b: Ball) => (config ? formatMultiplier(config.multipliers[b]) : '—');
  const probabilityOf = (b: Ball) => (config ? formatPercent(config.probabilities[b]) : '—');

  function applyShortcut(kind: 'min' | 'half' | 'double' | 'max') {
    if (!config) return;
    const clamp = (v: number) => Math.max(config.minBet, Math.min(config.maxBet, v));
    if (kind === 'min') setBet(config.minBet);
    if (kind === 'half') setBet(clamp(Math.floor(bet / 2 / 100) * 100 || config.minBet));
    if (kind === 'double') setBet(clamp(bet * 2));
    if (kind === 'max') setBet(Math.min(config.maxBet, user?.balance ?? config.maxBet));
  }

  const freeSpinActive = phase === 'free-spin-intro';

  return (
    <div className="container">
      <div className="spread mt">
        <div>
          <h1 className="page-title">Roleta de Bolas</h1>
          <p className="page-sub">
            Fita horizontal estilo PES myClub — arte original, créditos fictícios sem valor real.
          </p>
        </div>
        <div className="a11y-bar">
          <button
            className={`toggle-chip ${conscience ? 'on' : ''}`}
            aria-pressed={conscience}
            onClick={() => setConscience((v) => !v)}
          >
            {conscience ? '🧠 ' : ''}Modo Consciência
          </button>
          <button
            className={`toggle-chip ${reduceMotion ? 'on' : ''}`}
            aria-pressed={reduceMotion}
            onClick={() => setReduceMotion((v) => !v)}
          >
            {reduceMotion ? '✓ ' : ''}Reduzir animações
          </button>
          <button
            className={`toggle-chip ${muted ? '' : 'on'}`}
            aria-pressed={!muted}
            onClick={() => setMuted((v) => !v)}
          >
            {muted ? '🔇 Som desligado' : '🔊 Som ligado'}
          </button>
        </div>
      </div>

      <div className="roulette-layout">
        {/* ---------- Palco da fita ---------- */}
        <section>
          <div
            className={`roulette-stage${revel?.isBlackFlash ? ' black-flash' : ''}${
              revel?.isBlackFlash && !reduced ? ' shaking' : ''
            }`}
          >
            <TapeRoulette
              result={revel?.step.ball ?? null}
              spinNonce={spinNonce}
              reduced={reduced}
              config={config}
              onSettled={handleSettled}
              onTick={() => playSound('tick', muted)}
            />
            {revel?.showParticles && <WinnerParticles intensity={revel.isBlackFlash ? 36 : 18} />}

            <div className="reveal" aria-live="polite">
              {freeSpinActive ? (
                <div className="free-spin-msg">TENTATIVA GRÁTIS! 🎉</div>
              ) : revel ? (
                <>
                  <span className="reveal-ball" style={{ opacity: 1 }}>
                    {BALL_LABEL[revel.step.ball]}
                    {revel.step.isFreeSpin ? ' • tentativa grátis' : ''}
                  </span>
                  <span className={`reveal-mult${revel.step.ball === 'preta' ? ' big' : ''}`}>
                    {revel.step.ball === 'preta' ? '10x' : multiplierOf(revel.step.ball)}
                  </span>
                  <PayoutCounter cents={revel.step.payout} reduced={reduced} />
                </>
              ) : (
                <span className="muted small">
                  {phase === 'spinning' ? 'Girando…' : 'Clique em GIRAR para jogar'}
                </span>
              )}
            </div>
          </div>

          {/* Barra: legenda das 5 bolas, probabilidade e último resultado */}
          <div className="card mt ball-legend" style={{ display: 'grid', gap: 6 }}>
            <div className="spread" style={{ marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>Bolas</h3>
              <span className="muted small">último: {lastBall ? BALL_LABEL[lastBall] : '—'}</span>
            </div>
            {BALLS.map((b) => (
              <div key={b} className={`legend-item${lastBall === b ? ' last' : ''}`}>
                <span className={`legend-dot ${b}`} />
                <span className="legend-name">{BALL_LABEL[b]}</span>
                <span className="legend-prob">{probabilityOf(b)}</span>
                <span className="gold" style={{ fontWeight: 800, minWidth: 44, textAlign: 'right' }}>
                  {multiplierOf(b)}
                </span>
              </div>
            ))}
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              O multiplicador é o <b>retorno total da rodada</b> (já inclui a aposta). Bronze = 1
              tentativa grátis sem débito e sem encadeamento. A fita é gerada de forma neutra com
              as probabilidades configuradas — sem vizinhança manipulada.
            </p>
          </div>
        </section>

        {/* ---------- Painel de aposta ---------- */}
        <aside>
          <div className="card bet-panel">
            <div className="spread">
              <span className="muted small">Saldo</span>
              <b className="gold" style={{ fontSize: 20 }}>
                {formatCredits(user?.balance ?? 0)}
              </b>
            </div>

            <label className="field mt" style={{ marginBottom: 4 }}>
              Aposta (créditos)
              <input
                className="text-input"
                type="number"
                inputMode="numeric"
                min={config ? config.minBet / CENTS_PER_CREDIT : 1}
                max={config ? config.maxBet / CENTS_PER_CREDIT : undefined}
                step={1}
                value={bet / CENTS_PER_CREDIT}
                disabled={busy}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value) * CENTS_PER_CREDIT);
                  setBet(Number.isFinite(v) && v > 0 ? v : 0);
                }}
              />
            </label>

            <div className="bet-shortcuts">
              <button className="btn btn-ghost" disabled={busy} onClick={() => applyShortcut('min')}>
                Mín
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => applyShortcut('half')}>
                ½
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => applyShortcut('double')}>
                2x
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => applyShortcut('max')}>
                Máx
              </button>
            </div>

            <button className="spin-btn" disabled={busy || !config} onClick={() => void onSpin()}>
              {busy ? '…' : 'GIRAR'}
            </button>

            {error && <div className="error-box">{error}</div>}

            {config && (
              <p className="muted small center" style={{ marginBottom: 0 }}>
                Limites: {formatCredits(config.minBet)} – {formatCredits(config.maxBet)} • v
                {config.version} • Enter/Espaço gira
              </p>
            )}
          </div>

          {/* Histórico das últimas 10 rodadas */}
          <div className="card mt">
            <h3>Últimas 10 rodadas</h3>
            {recent.length === 0 ? (
              <p className="muted small">Nenhuma rodada ainda.</p>
            ) : (
              <div className="mini-history">
                {recent.map((r) => (
                  <span
                    key={r.roundId}
                    className={`mh-item ${
                      r.payout > 0
                        ? r.multiplier >= 500
                          ? 'big'
                          : 'win'
                        : r.isFreeSpin && r.ball === 'bronze'
                          ? 'free'
                          : 'loss'
                    }`}
                    title={`Aposta ${formatCredits(r.bet)} • retorno ${formatCredits(r.payout)}`}
                  >
                    {BALL_LABEL[r.ball]} {r.payout > 0 ? `+${formatCredits(r.payout)}` : '0'}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Regras + RTP teórico */}
          <div className="card mt">
            <h3>Regras & RTP</h3>
            <ul className="small muted" style={{ paddingLeft: 18, marginTop: 0 }}>
              <li>Branca: perde a aposta (0x).</li>
              <li>Bronze: 1 tentativa grátis — não debita e não encadeia nova grátis.</li>
              <li>Prata 1,5x • Dourada 2x • Preta 10x.</li>
            </ul>
            {config && (
              <div className="spread">
                <span className="small">
                  RTP teórico: <b className="gold">{formatRtp(config.rtp)}</b>
                </span>
                <span className="small">
                  Banca: <b className="red">{formatRtp(config.houseEdge)}</b>
                </span>
              </div>
            )}
            <p className="muted small" style={{ marginBottom: 0 }}>
              Configuração global e igual para todos os jogadores (v{config?.version ?? '—'}).
            </p>
          </div>
        </aside>
      </div>

      {/* ---------- Modo Consciência (educativo) ---------- */}
      {conscience && config && (
        <ConsciencePanel
          rtp={config.rtp}
          balance={user?.balance ?? 0}
          bet={bet}
          session={session}
          history={chartHistory}
        />
      )}
    </div>
  );
}

/** Contador animado do prêmio — exibe sempre o valor vindo da API. */
function PayoutCounter({ cents, reduced }: { cents: number; reduced: boolean }) {
  const [shown, setShown] = useState(reduced ? cents : 0);

  useEffect(() => {
    if (reduced) {
      setShown(cents);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const duration = 700;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setShown(Math.round(cents * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cents, reduced]);

  if (cents <= 0) return <span className="reveal-payout red">+0,00 créditos</span>;
  return (
    <span className="reveal-payout">
      +{formatCredits(shown)} créditos
      <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
        {' '}
        (fictícios)
      </span>
    </span>
  );
}
