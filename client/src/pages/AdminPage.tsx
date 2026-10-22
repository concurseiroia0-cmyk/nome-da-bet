/**
 * Painel admin (papel "admin"):
 *  - editar probabilidades/multiplicadores com prévia de RTP antes de confirmar;
 *  - histórico de versões (data e autor);
 *  - estatísticas agregadas;
 *  - lista de usuários com reset de saldo de teste.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  BALLS,
  BALL_LABEL,
  PROBABILITY_TOTAL,
  type AdminStatsDTO,
  type AdminUserDTO,
  type Ball,
  type GameConfigVersionDTO,
  type RTPPreviewDTO,
} from '@shared';
import { api, ApiError } from '../api.ts';
import { formatCredits, formatPercent, formatRtp } from '../utils.ts';

interface AdminConfigResponse {
  current: {
    version: number;
    probabilities: Record<Ball, number>;
    multipliers: Record<Ball, number>;
    minBet: number;
    maxBet: number;
    updatedAt: string;
  };
  rtp: { rtp: number; houseEdge: number; expectedReturn: number };
  versions: GameConfigVersionDTO[];
}

type EditorState = {
  probabilities: Record<Ball, number>;
  multipliers: Record<Ball, number>;
  minBet: number;
  maxBet: number;
};

export function AdminPage() {
  const [cfg, setCfg] = useState<AdminConfigResponse | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [preview, setPreview] = useState<RTPPreviewDTO | null>(null);
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [c, s, u] = await Promise.all([api.adminConfig(), api.adminStats(), api.adminUsers()]);
      setCfg(c);
      setEditor({
        probabilities: { ...c.current.probabilities },
        multipliers: { ...c.current.multipliers },
        minBet: c.current.minBet,
        maxBet: c.current.maxBet,
      });
      setStats(s);
      setUsers(u.users);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados do admin.');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Prévia de RTP a cada alteração (debounce simples).
  useEffect(() => {
    if (!editor) return;
    const t = setTimeout(() => {
      api
        .adminPreview(editor.probabilities, editor.multipliers)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [editor]);

  const probSum = editor ? BALLS.reduce((acc, b) => acc + editor.probabilities[b], 0) : 0;
  const canSave =
    !!editor && probSum === PROBABILITY_TOTAL && editor.minBet > 0 && editor.maxBet > editor.minBet && !busy;

  async function save() {
    if (!editor) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await api.adminSaveConfig(editor);
      setOk(`Configuração salva como versão ${res.current.version}. RTP ${formatRtp(res.preview.rtp ?? 0)}.`);
      await loadAll();
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function resetUser(id: number, email: string) {
    if (!window.confirm(`Restaurar saldo de teste de ${email} para 1.000 créditos?`)) return;
    try {
      await api.adminResetUser(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, balance: 100_000 } : u)));
      setOk(`Saldo de ${email} restaurado.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao resetar saldo.');
    }
  }

  const maxDist = stats ? Math.max(1, ...BALLS.map((b) => stats.ballDistribution[b])) : 1;

  return (
    <div className="container">
      <h1 className="page-title">Painel admin</h1>
      <p className="page-sub">
        Configuração global da Roleta de Bolas — igual para todos os jogadores. Créditos fictícios.
      </p>

      {error && <div className="error-box">{error}</div>}
      {ok && <div className="ok-box">{ok}</div>}

      {/* ---- Métricas ---- */}
      <div className="grid grid-3">
        <div className="metric-card">
          <div className="metric-label">Total apostado</div>
          <div className="metric-value">{stats ? formatCredits(stats.totalBet) : '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total pago</div>
          <div className="metric-value green">{stats ? formatCredits(stats.totalPaid) : '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Lucro fictício da banca</div>
          <div className="metric-value red">
            {stats ? formatCredits(stats.houseProfit) : '—'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">RTP real acumulado</div>
          <div className="metric-value">{stats ? formatRtp(stats.realRtp) : '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Rodadas</div>
          <div className="metric-value">{stats?.roundCount ?? '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tentativas grátis</div>
          <div className="metric-value">{stats?.freeSpinCount ?? '—'}</div>
        </div>
      </div>

      {/* ---- Distribuição de bolas ---- */}
      <div className="card mt">
        <h3>Distribuição de bolas</h3>
        {BALLS.map((b) => {
          const count = stats?.ballDistribution[b] ?? 0;
          const pct = stats && stats.roundCount > 0 ? (count / stats.roundCount) * 100 : 0;
          return (
            <div className="bar-row" key={b}>
              <span className="bar-label">{BALL_LABEL[b]}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(count / maxDist) * 100}%` }} />
              </div>
              <span className="bar-value">
                {count} ({pct.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-2 mt">
        {/* ---- Editor de configuração ---- */}
        <div className="card">
          <h3>
            Configuração vigente{' '}
            <span className="pill admin">v{cfg?.current.version ?? '—'}</span>
          </h3>
          {editor && (
            <>
              <h4 className="muted small">Probabilidades (partes por 10.000 • soma = 10.000)</h4>
              <table className="data">
                <tbody>
                  {BALLS.map((b) => (
                    <tr key={b}>
                      <td>{BALL_LABEL[b]}</td>
                      <td>
                        <input
                          className="text-input"
                          type="number"
                          min={0}
                          value={editor.probabilities[b]}
                          onChange={(e) =>
                            setEditor((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    probabilities: {
                                      ...prev.probabilities,
                                      [b]: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                    },
                                  }
                                : prev,
                            )
                          }
                        />
                      </td>
                      <td className="gold">{formatPercent(editor.probabilities[b])}</td>
                    </tr>
                  ))}
                  <tr>
                    <th>Soma</th>
                    <th>{probSum}</th>
                    <th className={probSum === PROBABILITY_TOTAL ? 'green' : 'red'}>
                      {probSum === PROBABILITY_TOTAL ? '✓ = 100%' : '✗ precisa ser 10.000'}
                    </th>
                  </tr>
                </tbody>
              </table>

              <h4 className="muted small mt">Multiplicadores (centésimos — retorno total)</h4>
              <table className="data">
                <tbody>
                  {BALLS.map((b) => (
                    <tr key={b}>
                      <td>{BALL_LABEL[b]}</td>
                      <td>
                        <input
                          className="text-input"
                          type="number"
                          min={0}
                          value={editor.multipliers[b]}
                          onChange={(e) =>
                            setEditor((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    multipliers: {
                                      ...prev.multipliers,
                                      [b]: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                    },
                                  }
                                : prev,
                            )
                          }
                        />
                      </td>
                      <td className="gold">{(editor.multipliers[b] / 100).toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-2 mt">
                <label className="field">
                  Aposta mínima (centésimos)
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    value={editor.minBet}
                    onChange={(e) =>
                      setEditor((p) => (p ? { ...p, minBet: Math.round(Number(e.target.value) || 0) } : p))
                    }
                  />
                </label>
                <label className="field">
                  Aposta máxima (centésimos)
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    value={editor.maxBet}
                    onChange={(e) =>
                      setEditor((p) => (p ? { ...p, maxBet: Math.round(Number(e.target.value) || 0) } : p))
                    }
                  />
                </label>
              </div>

              {/* Prévia do RTP antes de confirmar */}
              <div className={`card mt ${preview?.valid ? 'ok-box' : 'error-box'}`} style={{ margin: '12px 0' }}>
                {!preview || !preview.valid ? (
                  <span>Prévia indisponível — confira a soma das probabilidades (= 10.000).</span>
                ) : (
                  <span>
                    Prévia: RTP <b>{formatRtp(preview.rtp ?? 0)}</b> • banca{' '}
                    <b>{formatRtp(preview.houseEdge ?? 0)}</b> • retorno esperado por aposta{' '}
                    <b>{((preview.expectedReturn ?? 0) * 100).toFixed(2)}%</b>. Salvar como nova
                    versão?
                  </span>
                )}
              </div>

              <button className="btn btn-gold" disabled={!canSave} onClick={() => void save()}>
                {busy ? 'Salvando…' : 'Confirmar e salvar nova versão'}
              </button>
            </>
          )}
        </div>

        {/* ---- Histórico de versões ---- */}
        <div className="card">
          <h3>Histórico de versões</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>v</th>
                  <th>Data</th>
                  <th>Autor</th>
                  <th>RTP das probs.</th>
                </tr>
              </thead>
              <tbody>
                {cfg?.versions.map((v) => {
                  const rtp =
                    BALLS.reduce(
                      (acc, b) => acc + (v.probabilities[b] / 10_000) * (v.multipliers[b] / 100),
                      0,
                    );
                  return (
                    <tr key={v.id}>
                      <td className="gold">{v.version}</td>
                      <td className="muted small">{new Date(v.updatedAt).toLocaleString('pt-BR')}</td>
                      <td className="muted small">{v.updatedByEmail ?? '—'}</td>
                      <td>{formatRtp(rtp)}</td>
                    </tr>
                  );
                })}
                {cfg && cfg.versions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted center">
                      Sem versões.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="spread mt">
            <span className="small">
              RTP teórico atual: <b className="gold">{cfg ? formatRtp(cfg.rtp.rtp) : '—'}</b>
            </span>
            <span className="small">
              Banca: <b className="red">{cfg ? formatRtp(cfg.rtp.houseEdge) : '—'}</b>
            </span>
          </div>
        </div>
      </div>

      {/* ---- Usuários ---- */}
      <div className="card mt">
        <h3>Usuários</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Saldo</th>
                <th>Rodadas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`pill ${u.role === 'admin' ? 'admin' : 'loss'}`}>{u.role}</span>
                  </td>
                  <td className="gold">{formatCredits(u.balance)}</td>
                  <td>{u.roundCount}</td>
                  <td>
                    <button className="btn btn-sm btn-red" onClick={() => void resetUser(u.id, u.email)}>
                      Redefinir saldo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
