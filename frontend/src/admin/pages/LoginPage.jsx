import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Auth0 Universal Login entry for the admin panel only.
 * Does not affect the public game at /.
 */
export default function LoginPage() {
  const { admin, login, isAuth0Loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (admin) navigate('/questions');
  }, [admin, navigate]);

  if (isAuth0Loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.subtitle}>Checking session…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Admin Panel</h1>
        <p style={styles.subtitle}>
          Secure sign-in with Auth0. Only authorized staff can access this area.
        </p>
        {isAuthenticated && !admin ? (
          <p style={styles.hint}>Signed in — preparing admin session…</p>
        ) : (
          <button type="button" style={styles.button} onClick={() => login()}>
            Sign in with Auth0
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #880e4f 0%, #e91e8c 50%, #f8bbd0 100%)',
  },
  card: {
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(136,14,79,0.25)',
    textAlign: 'center',
    minWidth: '320px',
    maxWidth: '420px',
  },
  title: { margin: '0 0 0.5rem', fontSize: '1.8rem', color: '#880e4f' },
  subtitle: { color: '#666', marginBottom: '1.5rem', lineHeight: 1.45 },
  hint: { color: '#888', margin: 0 },
  button: {
    background: '#880e4f',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.85rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
};
