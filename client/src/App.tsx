/** Roteador e layout raiz da DEMO. */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.tsx';
import type { ReactNode } from 'react';
import { DemoBanner } from './components/DemoBanner.tsx';
import { TopBar } from './components/TopBar.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { LobbyPage } from './pages/LobbyPage.tsx';
import { RoulettePage } from './pages/RoulettePage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="container center mt">
        <p className="muted">Carregando…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/entrar" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <DemoBanner />
        <TopBar />
        <Routes>
          <Route path="/entrar" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <LobbyPage />
              </RequireAuth>
            }
          />
          <Route
            path="/roleta"
            element={
              <RequireAuth>
                <RoulettePage />
              </RequireAuth>
            }
          />
          <Route
            path="/historico"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
