import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  const login = async (email, senha, manter = true) => {
    const d = await api.post('/auth/login', { email, senha });
    setToken(d.token, manter);
    setUser({ ...d.user });
  };
  const logout = () => { setToken(null); setUser(null); location.href = '/login'; };

  if (!ready) return null;
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function Protected({ children, dono }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (dono && user.perfil !== 'dono') return <p className="err">Acesso restrito ao Dono.</p>;
  return children;
}
