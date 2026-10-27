import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { isMock } from './lib/backend';
import { Alerts } from './pages/Alerts';
import { Landing } from './pages/Landing';
import { Legal } from './pages/Legal';
import { Trust } from './pages/Trust';
import { Zone } from './pages/Zone';
import { MeProvider, useMe } from './state/me';

function RequireLogin({ children }: { children: ReactNode }) {
  const { loading, unauthorized } = useMe();
  if (loading) return <div className="page-loading">Đang tải…</div>;
  if (unauthorized) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Bản giả lập dùng HashRouter để chạy được ở bất kỳ đâu (kể cả file tĩnh)
const Router = isMock ? HashRouter : BrowserRouter;

export function App() {
  return (
    <MeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route
            element={
              <RequireLogin>
                <Shell />
              </RequireLogin>
            }
          >
            <Route path="/zone" element={<Zone />} />
            <Route path="/canh-bao" element={<Alerts />} />
            <Route path="/diem" element={<Trust />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MeProvider>
  );
}
