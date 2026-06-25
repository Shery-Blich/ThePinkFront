import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(undefined); // undefined = loading, null = not logged in

  useEffect(() => {
    api.get('/auth/me')
      .then((r) => setAdmin(r.data))
      .catch(() => setAdmin(null));
  }, []);

  const logout = async () => {
    await api.post('/auth/logout');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, setAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
