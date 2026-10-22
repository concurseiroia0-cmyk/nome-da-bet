/** Topbar fixa: marca, navegação, saldo (vindo da API) e sair. */
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.tsx';
import { formatCredits } from '../utils.ts';

export function TopBar() {
  const { user, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          [NOME DA BET]
          <span className="brand-sub">demo • créditos fictícios</span>
        </div>
        <nav aria-label="Navegação principal">
          <NavLink to="/" end>
            Lobby
          </NavLink>
          <NavLink to="/roleta">Roleta</NavLink>
          <NavLink to="/historico">Histórico</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="topbar-right">
          {user && (
            <span className="balance-pill" title="Saldo em créditos fictícios (valor da API)">
              <small>Saldo</small> {formatCredits(user.balance)}
            </span>
          )}
          {user && (
            <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>
              Sair
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
