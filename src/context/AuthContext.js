// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AuthAPI, AccountAPI, setToken, setRefreshToken, setExpiresAt, setUserId,
  getToken, getUserId, clearAuth, clearLocalUserData, setOnAuthError,
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
      // Lưu refresh_token + expires_at để tự làm mới phiên (tránh 401 sau ~1h).
      if (result.refresh_token) await setRefreshToken(result.refresh_token);
      if (result.expires_at) await setExpiresAt(result.expires_at);
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

  /**
   * Xoá tài khoản vĩnh viễn rồi dọn sạch phiên tại máy.
   *
   * KHÔNG tự đặt token về null ở đây: màn Cài đặt cần hiện màn "đã xoá xong"
   * trước, mà đặt token null là RootNavigator lập tức đá về luồng đăng nhập và
   * người dùng không kịp thấy gì. Việc chuyển màn để bên gọi quyết định bằng
   * `finishDeletion()`.
   *
   * Dữ liệu cục bộ (khẩu phần đã ăn, nhắc nhở) xoá luôn — chúng thuộc về tài
   * khoản vừa bị xoá, để lại thì người đăng nhập sau trên cùng máy sẽ thấy.
   */
  const deleteAccount = useCallback(async () => {
    const res = await AccountAPI.deleteAccount();
    try { await clearAuth(); } catch {}
    try { await clearLocalUserData(); } catch {}
    return res;
  }, []);

  /** Rời khỏi phiên sau khi người dùng đã xem màn thành công. */
  const finishDeletion = useCallback(() => {
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, deleteAccount, finishDeletion }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
