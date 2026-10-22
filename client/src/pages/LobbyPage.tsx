/** Lobby: saldo no topo, cards de jogos e recarga de créditos de teste. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LobbyGameDTO } from '@shared';
import { api, ApiError } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { formatCredits } from '../utils.ts';

export function LobbyPage() {
  const { user, recharge } = useAuth();
  const [games, setGames] = useState<LobbyGameDTO[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .lobby()
      .then((r) => setGames(r.games))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar o lobby.'));
  }, []);

  async function onRecharge() {
    setError(null);
    try {
      await recharge();
      setMessage('Saldo de teste restaurado para 1.000 créditos fictícios.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao recarregar.');
    }
  }

  return (
    <div className="container">
      <div className="spread mt">
        <div>
          <h1 className="page-title">Lobby</h1>
          <p className="page-sub">
            Saldo atual: <b className="gold">{formatCredits(user?.balance ?? 0)} créditos</b> — sem
            valor real.
          </p>
        </div>
        <button className="btn btn-red" onClick={() => void onRecharge()}>
          Recarregar créditos de teste
        </button>
      </div>

      {message && <div className="ok-box">{message}</div>}
      {error && <div className="error-box">{error}</div>}

      <div className="grid grid-2 mt">
        {games.map((game) =>
          game.status === 'available' ? (
            <Link key={game.id} to="/roleta" style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="game-card active">
                <span className="status-chip available">Disponível</span>
                <h3 className="gold">{game.name}</h3>
                <p>{game.description}</p>
                <span className="btn btn-gold" style={{ textAlign: 'center' }}>
                  Jogar
                </span>
              </article>
            </Link>
          ) : (
            <article key={game.id} className="game-card" aria-disabled="true">
              <span className="status-chip soon">Em breve</span>
              <h3>{game.name}</h3>
              <p>{game.description}</p>
              <span className="btn" style={{ textAlign: 'center', opacity: 0.5 }} aria-disabled="true">
                Em breve
              </span>
            </article>
          ),
        )}
      </div>

      <div className="card mt">
        <h3>Sobre esta DEMO</h3>
        <p className="muted small">
          Todos os valores são <b>créditos fictícios sem valor real</b>. Não há depósito, saque,
          pagamento ou qualquer integração financeira. O resultado das rodadas é sorteado no servidor
          <i> antes </i> da animação; o cliente apenas exibe.
        </p>
      </div>
    </div>
  );
}
