// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AuthAPI, setToken, setUserId, getToken, getUserId, clearAuth, setOnAuthError,
} from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap session từ AsyncStorage
  useEffect(() => {
    (async () => {
      const t = await getToken();
      const uid = await getUserId();
      if (t) {
        setTokenState(t);
        setUser({ id: uid });
      }
      setLoading(false);
    })();
  }, []);

  // Đăng ký auto-logout khi apiFetch nhận 401/403
  useEffect(() => {
    setOnAuthError(() => {
      setTokenState(null);
      setUser(null);
    });
    return () => setOnAuthError(null);
  }, []);

  const login = useCallback(async (emailOrUsername, password) => {
    const result = await AuthAPI.login(emailOrUsername, password);
    if (result?.token) {
      await setToken(result.token);
      if (result.user?.id) await setUserId(result.user.id);
      setTokenState(result.token);
      setUser(result.user || { id: result.user_id });
    }
    return result;
  }, []);

  const register = useCallback(async (payload) => AuthAPI.register(payload), []);

  const logout = useCallback(async () => {
    try { await AuthAPI.logout(); } catch {}
    try { await clearAuth(); } catch {}
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
