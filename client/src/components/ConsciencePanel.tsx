/**
 * MODO CONSCIÊNCIA (spec 8.4) — painel educativo, ligável no topo do jogo.
 *
 * Explica em tempo real as técnicas que o design do jogo usa para manter o
 * jogador (reforço de razão variável, antecipação, efeito sensorial, perdas
 * disfarçadas de vitória, viés do quase-ganho) e mostra os NÚMEROS REAIS da
 * sessão: quanto foi apostado, quanto voltou, saldo, RTP real vs. teórico e
 * uma estimativa honesta de quantas rodadas zerariam o saldo.
 *
 * Este painel existe justamente porque o entretenimento do jogo se apoia em
 * viéses cognitivos — aqui eles são nomeados, não explorados.
 */
import { useEffect, useState } from 'react';
import type { RoundStepDTO } from '@shared';
import { formatCredits, formatPercent, formatRtp } from '../utils.ts';

export interface SessionStats {
  /** Total de créditos debitados (apenas rodadas pagas). */
  totalBet: number;
  /** Total de créditos pagos (inclui tentativas grátis). */
  totalPaid: number;
  /** Quantidade de giros (botões GIRAR pressionados). */
  rounds: number;
  /** Timestamp do início da sessão. */
  startedAt: number;
}

interface Props {
  /** RTP teórico (fração, ex.: 0.693). */
  rtp: number;
  /** Saldo atual (centésimos). */
  balance: number;
  /** Aposta atual configurada na tela (centésimos). */
  bet: number;
  session: SessionStats;
  /** Histórico recente (usado no gráfico). */
  history: RoundStepDTO[];
}

const TIPOS: { titulo: string; texto: string }[] = [
  {
    titulo: '1. Reforço de razão variável',
    texto:
      'Prêmios que chegam em intervalos imprevisíveis são o padrão de reforço que MAIS mantém um comportamento — mais do que recompensa fixa. É o mesmo mecanismo das caixas de som e das máquinas: você não sabe qual giro premia, então joga "mais um".',
  },
  {
    titulo: '2. Antecipação (dopamina)',
    texto:
      'Pesquisas indicam que o cérebro libera mais dopamina na EXPECTATIVA do resultado do que no resultado em si. Por isso a desaceleração longa da fita: cada bola que passa pelo marcador é um "quase". O prêmio já está decidido no servidor antes do primeiro frame.',
  },
  {
    titulo: '3. Efeito sensorial',
    texto:
      'Som, luz e partículas nas vitórias — silêncio e tela neutra nas derrotas — fazem as vitórias parecerem mais frequentes do que a matemática permite. Desligue o som e observe: a frequência de prêmios é exatamente a mesma.',
  },
  {
    titulo: '4. Perdas disfarçadas de vitória',
    texto:
      'A bola bronze ("tentativa grátis") e uma prata de 1,5x que paga menos do que a rodada anterior perdida geram sensação de GANHO com o saldo em queda. Sensação de vitória ≠ vitória: olhe o saldo líquido aqui embaixo.',
  },
  {
    titulo: '5. Viés do quase-ganho',
    texto:
      'Bolas valiosas aparecendo perto do marcador parecem "sinais" de que a próxima vai cair — mas a fita aqui é NEUTRA: cada posição é sorteada com as probabilidades configuradas, sem vizinhança manipulada. A proximidade é coincidência estatística, não preparação do sistema.',
  },
];

export function ConsciencePanel({ rtp, balance, bet, session, history }: Props) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const net = session.totalPaid - session.totalBet;
  const realRtp = session.totalBet > 0 ? session.totalPaid / session.totalBet : null;
  const elapsedMs = Math.max(0, Date.now() - session.startedAt);
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  // Estimativa honesta (média, não garantia): cada giro devora aposta×(1−RTP).
  const costPerRound = bet * (1 - rtp);
  const roundsToZero = costPerRound > 0 && balance > 0 ? Math.floor(balance / costPerRound) : null;

  return (
    <section className="card conscience" aria-label="Modo Consciência">
      <div className="spread">
        <h3 style={{ margin: 0 }}>🧠 Modo Consciência</h3>
        <span className="pill admin">educativo</span>
      </div>
      <p className="muted small">
        O jogo é desenhado para te manter jogando. Aqui as técnicas são nomeadas e os números
        REAIS da sua sessão ficam à vista — créditos fictícios, mas a matemática é a mesma de um
        cassino de verdade.
      </p>

      <div className="grid grid-3 mt">
        <div className="metric-card">
          <div className="metric-label">Total apostado</div>
          <div className="metric-value">{formatCredits(session.totalBet)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total recebido</div>
          <div className="metric-value green">{formatCredits(session.totalPaid)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Resultado líquido</div>
          <div className={`metric-value ${net >= 0 ? 'green' : 'red'}`}>
            {net >= 0 ? '+' : ''}
            {formatCredits(net)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">RTP real da sessão</div>
          <div className="metric-value">
            {realRtp === null ? '—' : formatRtp(realRtp)}
            <div className="muted small" style={{ fontWeight: 500 }}>
              teórico: {formatRtp(rtp)}
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tempo jogado</div>
          <div className="metric-value">
            {minutes}min {seconds}s
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Giros / saldo atual</div>
          <div className="metric-value">
            {session.rounds} / {formatCredits(balance)}
          </div>
        </div>
      </div>

      <div className="ok-box mt">
        <b>Quantas rodadas até zerar?</b> Com aposta de {formatCredits(bet)} e RTP {formatRtp(rtp)},
        cada giro custa em média <b>{formatCredits(Math.round(costPerRound))}</b>. Do saldo atual,
        a média matemática é ≈ <b className="gold">{roundsToZero ?? '∞'}</b> rodadas até zero — o
        desvio em uma sessão real é grande, mas a direção (a banca leva ~30,7%) nunca muda.
      </div>

      <BalanceChart history={history} rtp={rtp} />

      <div className="grid grid-2 mt">
        {TIPOS.map((t) => (
          <div key={t.titulo} className="conscience-tip">
            <b>{t.titulo}</b>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {t.texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Gráfico do saldo ao longo das rodadas com a linha da expectativa matemática. */
function BalanceChart({ history, rtp }: { history: RoundStepDTO[]; rtp: number }) {
  if (history.length < 2) {
    return (
      <div className="card mt">
        <h3>Saldo × rodadas</h3>
        <p className="muted small">Jogue algumas rodadas para ver a curva.</p>
      </div>
    );
  }

  const asc = [...history].reverse();
  const startBalance = asc[0].balanceBefore;
  const balances = asc.map((r) => r.balanceAfter);
  // Expectativa: cada rodada deduz aposta×(1−RTP) na média.
  let expected = startBalance;
  const expectedSeries = asc.map((r) => {
    expected -= r.bet * (1 - rtp);
    return expected;
  });

  const W = 600;
  const H = 160;
  const PAD = 10;
  const all = [...balances, ...expectedSeries];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  const x = (i: number) => PAD + (i / (asc.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
  const toPoly = (series: number[]) => series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <div className="card mt">
      <h3>Saldo × rodadas</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="balance-chart" role="img"
        aria-label="Gráfico do saldo por rodada comparado à expectativa matemática">
        <polyline points={toPoly(expectedSeries)} fill="none" stroke="#9a9aab" strokeWidth="1.5" strokeDasharray="5 4" />
        <polyline points={toPoly(balances)} fill="none" stroke="#FFD700" strokeWidth="2.5" />
      </svg>
      <div className="spread small muted">
        <span>— linha dourada: seu saldo real</span>
        <span>-- linha tracejada: expectativa matemática (RTP {formatPercent(rtp * 10000)})</span>
      </div>
    </div>
  );
}
