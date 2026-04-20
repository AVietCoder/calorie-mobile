import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthAPI, setToken, setUserId, getToken, getUserId, clearAuth } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const login = useCallback(async (username, password) => {
    const result = await AuthAPI.login(username, password);
    if (result?.token) {
      await setToken(result.token);
      if (result.user?.id) await setUserId(result.user.id);
      setTokenState(result.token);
      setUser(result.user || { id: result.user_id });
    }
    return result;
  }, []);

  const register = useCallback(async (payload) => {
    return AuthAPI.register(payload);
  }, []);

  /**
   * Logout: clear AsyncStorage + reset state.
   * RootNavigator tự switch sang AuthNavigator khi token = null.
   * Không cần navigation.reset() vì navigator dựa hoàn toàn vào `token`.
   */
  const logout = useCallback(async () => {
    try {
      await clearAuth();
    } catch (e) {
      // ignore
    }
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
