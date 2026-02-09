import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken, setToken, clearToken, onAuthChange, getUserRole } from '../auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());
  const [role, setRole] = useState(getUserRole());

  useEffect(() => {
    onAuthChange((newToken) => {
      setTokenState(newToken);
      setRole(getUserRole());
    });
  }, []);

  const login = useCallback((newToken) => {
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    clearToken();
  }, []);

  const isAuditor = role === 'admin';

  return (
    <AuthContext.Provider value={{ token, role, isAuditor, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
