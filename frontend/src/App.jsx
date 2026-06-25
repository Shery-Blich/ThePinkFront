import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './admin/pages/LoginPage.jsx';
import QuestionsPage from './admin/pages/QuestionsPage.jsx';
import AnalyticsPage from './admin/pages/AnalyticsPage.jsx';

function ProtectedRoute({ children }) {
  const { admin } = useAuth();
  if (admin === undefined) return <p style={{ padding: '2rem' }}>Loading...</p>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

function AdminLayout({ children }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div style={styles.layout}>
      <nav style={styles.nav}>
        <span style={styles.navBrand}>Admin Panel</span>
        <div style={styles.navLinks}>
          <Link style={styles.navLink} to="/admin/questions">Questions</Link>
          <Link style={styles.navLink} to="/admin/analytics">Analytics</Link>
        </div>
        <div style={styles.navUser}>
          <span style={{ color: '#eee', fontSize: '0.85rem' }}>{admin?.email}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin/questions"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <QuestionsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AnalyticsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/admin/questions" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

const styles = {
  layout: { minHeight: '100vh', background: '#f5f5f5' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#880e4f', padding: '0 1.5rem', height: '56px', gap: '1rem',
  },
  navBrand: { color: '#fff', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 },
  navLinks: { display: 'flex', gap: '1.5rem' },
  navLink: { color: '#f8bbd0', textDecoration: 'none', fontWeight: 500 },
  navUser: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' },
  logoutBtn: { padding: '0.3rem 0.8rem', background: 'transparent', color: '#fff', border: '1px solid #f48fb1', borderRadius: '4px', cursor: 'pointer' },
  main: { padding: '1.5rem' },
};
