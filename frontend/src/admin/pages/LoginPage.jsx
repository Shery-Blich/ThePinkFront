import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../api/client.js';

export default function LoginPage() {
  const { admin, setAdmin } = useAuth();
  const buttonRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (admin) navigate('/admin/questions');
  }, [admin, navigate]);

  useEffect(() => {
    if (!window.google || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        try {
          const { data } = await api.post('/auth/google', { credential });
          setAdmin(data);
          navigate('/admin/questions');
        } catch (err) {
          alert(err.response?.data?.error || 'Login failed');
        }
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
    });
  }, [navigate, setAdmin]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Admin Panel</h1>
        <p style={styles.subtitle}>Sign in with your authorized Google account</p>
        <div ref={buttonRef} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #880e4f 0%, #e91e8c 50%, #f8bbd0 100%)',
  },
  card: {
    background: '#fff', padding: '2.5rem', borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(136,14,79,0.25)', textAlign: 'center', minWidth: '320px',
  },
  title: { margin: '0 0 0.5rem', fontSize: '1.8rem', color: '#880e4f' },
  subtitle: { color: '#888', marginBottom: '1.5rem' },
};
