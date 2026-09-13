/* eslint-disable react/prop-types */
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './admin/pages/LoginPage.jsx';
import QuestionsPage from './admin/pages/QuestionsPage.jsx';
import AnalyticsPage from './admin/pages/AnalyticsPage.jsx';
import NotFoundPage from './admin/pages/NotFoundPage.jsx';

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;

function adminOriginBase() {
  // Vite BASE_URL is `/admin/` in production Firebase builds
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}`.replace(/\/?$/, '/');
}

function ProtectedRoute({ children }) {
  const { admin, isAuth0Loading, isAuthenticated, login } = useAuth();

  if (isAuth0Loading || admin === undefined) {
    return <p style={{ padding: '2rem' }}>Loading…</p>;
  }

  if (!isAuthenticated || !admin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>You must sign in to open the admin panel.</p>
        <button type="button" onClick={() => login()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Sign in with Auth0
        </button>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/login">Go to login page</Link>
        </p>
      </div>
    );
  }

  return children;
}

function AdminLayout({ children }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={styles.layout}>
      <nav style={styles.nav}>
        <span style={styles.navBrand}>Admin Panel</span>
        <div style={styles.navLinks}>
          <Link style={styles.navLink} to="/questions">
            Questions
          </Link>
          <Link style={styles.navLink} to="/analytics">
            Analytics
          </Link>
        </div>
        <div style={styles.navUser}>
          <span style={{ color: '#eee', fontSize: '0.85rem' }}>{admin?.email}</span>
          <button type="button" style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

function Auth0RedirectHandler({ children }) {
  const { isLoading } = useAuth0();
  if (isLoading) {
    return <p style={{ padding: '2rem' }}>Loading Auth0…</p>;
  }
  return children;
}

function AppRoutes() {
  // Production admin is served under /admin/ — basename keeps React Router in sync
  const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined;

  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <Auth0RedirectHandler>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/questions" replace />} />
            <Route
              path="/questions"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <QuestionsPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AnalyticsPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <NotFoundPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Auth0RedirectHandler>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default function App() {
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Admin Auth0 not configured</h1>
        <p>
          Set <code>VITE_AUTH0_DOMAIN</code> and <code>VITE_AUTH0_CLIENT_ID</code> in{' '}
          <code>frontend/.env</code> (see <code>frontend/.env.example</code>).
        </p>
        <p>The public game at / is unaffected.</p>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: adminOriginBase(),
      }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <AppRoutes />
    </Auth0Provider>
  );
}

const styles = {
  layout: { minHeight: '100vh', background: '#f5f5f5' },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#880e4f',
    padding: '0 1.5rem',
    height: '56px',
    gap: '1rem',
  },
  navBrand: { color: '#fff', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 },
  navLinks: { display: 'flex', gap: '1.5rem' },
  navLink: { color: '#f8bbd0', textDecoration: 'none', fontWeight: 500 },
  navUser: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' },
  logoutBtn: {
    padding: '0.3rem 0.8rem',
    background: 'transparent',
    color: '#fff',
    border: '1px solid #f48fb1',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  main: { padding: '1.5rem' },
};
