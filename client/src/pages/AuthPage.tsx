/** Login/Cadastro simples: e-mail + senha (hash bcrypt, JWT em cookie httpOnly). */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.tsx';
import { ApiError } from '../api.ts';
import { INITIAL_CREDITS } from '@shared';

export function AuthPage() {
  const { login, register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    navigate('/', { replace: true });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth-wrap">
      <div className="card">
        <h2 className="gold center">[NOME DA BET]</h2>
        <p className="center muted small">
          DEMO com créditos fictícios. Sem depósito, saque ou pagamento real.
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            Entrar
          </button>
          <button
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
            type="button"
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="field">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              minLength={5}
              maxLength={254}
              placeholder="voce@exemplo.com"
            />
          </label>
          <label className="field">
            Senha {mode === 'register' && <span className="muted">(mín. 8 caracteres)</span>}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : 1}
              maxLength={128}
            />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button className="btn btn-gold" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : `Criar conta e ganhar ${INITIAL_CREDITS} créditos`}
          </button>
        </form>

        <p className="muted small center mt">
          Contas de teste: <b>admin@bet.demo / admin1234</b> • <b>jogador@bet.demo / jogador1234</b>
        </p>
      </div>
    </div>
  );
}
