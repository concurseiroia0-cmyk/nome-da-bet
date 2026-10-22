/** Histórico paginado de todas as rodadas do usuário. */
import { useCallback, useEffect, useState } from 'react';
import type { HistoryResponseDTO } from '@shared';
import { api, ApiError } from '../api.ts';
import { formatCredits, formatMultiplier } from '../utils.ts';
import { BALL_LABEL, BALL_HEX } from '@shared';

const PAGE_SIZE = 20;

export function HistoryPage() {
  const [data, setData] = useState<HistoryResponseDTO | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    try {
      setData(await api.history(p, PAGE_SIZE));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar histórico.');
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="container">
      <h1 className="page-title">Histórico de rodadas</h1>
      <p className="page-sub">
        Todas as suas rodadas com saldo antes/depois — valores em créditos fictícios.
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Quando</th>
              <th>Aposta</th>
              <th>Bola</th>
              <th>Mult.</th>
              <th>Retorno</th>
              <th>Tipo</th>
              <th>Saldo após</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r.roundId}>
                <td>{r.roundId}</td>
                <td className="muted small">{new Date(r.createdAt).toLocaleString('pt-BR')}</td>
                <td>{formatCredits(r.bet)}</td>
                <td style={{ color: BALL_HEX[r.ball], fontWeight: 700 }}>{BALL_LABEL[r.ball]}</td>
                <td>{formatMultiplier(r.multiplier)}</td>
                <td className={r.payout > 0 ? 'green' : 'muted'}>{formatCredits(r.payout)}</td>
                <td>
                  {r.isFreeSpin ? (
                    <span className="pill free">grátis</span>
                  ) : r.payout > 0 ? (
                    <span className="pill win">ganho</span>
                  ) : (
                    <span className="pill loss">perda</span>
                  )}
                </td>
                <td className="gold">{formatCredits(r.balanceAfter)}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="center muted">
                  Nenhuma rodada registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="muted small">
            Página {data?.page ?? page} de {totalPages} • {data?.total ?? 0} rodadas
          </span>
          <button
            className="btn btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima →
          </button>
        </div>
      </div>
    </div>
  );
}
