import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import api from '../api/client.js';

const AuthContext = createContext(null);

/**
 * Admin auth: Auth0 (SPA) gates the /admin UI; after Auth0 login we exchange
 * the ID token for an httpOnly backend cookie so /api/questions and analytics stay protected.
 */
export function AuthProvider({ children }) {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getIdTokenClaims,
  } = useAuth0();

  // undefined = loading, null = not logged in, object = admin session
  const [admin, setAdmin] = useState(undefined);
  const [syncError, setSyncError] = useState(null);

  const syncBackendSession = useCallback(async () => {
    if (!isAuthenticated) {
      setAdmin(null);
      return;
    }

    try {
      const claims = await getIdTokenClaims();
      const idToken = claims?.__raw;
      if (!idToken) {
        setAdmin({ email: user?.email, name: user?.name });
        return;
      }

      const { data } = await api.post('/auth/auth0', { idToken });
      setAdmin(data);
      setSyncError(null);
    } catch (err) {
      // UI still allowed via Auth0; API may fail until backend is configured
      console.warn('Auth0 backend sync failed:', err?.response?.data || err.message);
      setSyncError(err?.response?.data?.error || err.message);
      setAdmin({
        email: user?.email,
        name: user?.name || user?.nickname,
      });
    }
  }, [isAuthenticated, getIdTokenClaims, user]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setAdmin(null);
      return;
    }
    syncBackendSession();
  }, [isLoading, isAuthenticated, syncBackendSession]);

  const login = () =>
    loginWithRedirect({
      appState: { returnTo: `${import.meta.env.BASE_URL || '/'}questions`.replace(/\/+/g, '/') },
    });

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* backend optional */
    }
    setAdmin(null);
    const returnTo = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`.replace(/\/?$/, '/');
    auth0Logout({ logoutParams: { returnTo } });
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        setAdmin,
        logout,
        login,
        isAuth0Loading: isLoading,
        isAuthenticated,
        syncError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
