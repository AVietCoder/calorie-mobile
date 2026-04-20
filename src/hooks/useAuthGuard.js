import { useEffect, useState } from 'react';
import { getToken, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

/**
 * Verify token bằng cách gọi /api/chat-history (KHỚP web).
 * - Nếu không có token hoặc API fail → logout → RootNavigator tự về SignIn
 * - Hiện toast "Vui lòng đăng nhập!" sau 1369ms (giống web)
 *
 * Dùng trên MỌI screen (trừ SignIn/SignUp).
 *
 * Trả về { checking } để screen có thể show loading overlay.
 */
export function useAuthGuard() {
  const { logout } = useAuth();
  const toast = useToast();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            toast.show('Vui lòng đăng nhập!', 'info');
            setTimeout(() => logout(), 1369);
          }
          return;
        }
        // Gọi /chat-history để verify token còn hiệu lực
        await apiFetch('/chat-history');
        if (!cancelled) setChecking(false);
      } catch (e) {
        if (!cancelled) {
          toast.show('Vui lòng đăng nhập!', 'info');
          setTimeout(() => logout(), 1369);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { checking };
}
