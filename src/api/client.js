// src/api/client.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { Platform } from 'react-native';

const TOKEN_KEY = 'calorie_ai_token';
const REFRESH_KEY = 'calorie_ai_refresh';
const EXPIRES_KEY = 'calorie_ai_expires_at';
const USER_ID_KEY = 'user_id';
const CHAT_CACHE_KEY = 'chat_history_cache_v1';
const PLAN_CACHE_KEY = 'plan_cache_v1';

export async function setToken(token) { await AsyncStorage.setItem(TOKEN_KEY, token); }
export async function getToken() { return AsyncStorage.getItem(TOKEN_KEY); }
export async function setRefreshToken(rt) { if (rt) await AsyncStorage.setItem(REFRESH_KEY, String(rt)); }
export async function getRefreshToken() { return AsyncStorage.getItem(REFRESH_KEY); }
export async function setExpiresAt(ts) { if (ts != null) await AsyncStorage.setItem(EXPIRES_KEY, String(ts)); }
export async function getExpiresAt() {
  const s = await AsyncStorage.getItem(EXPIRES_KEY);
  return s ? parseInt(s, 10) || 0 : 0;
}
export async function setUserId(id) { await AsyncStorage.setItem(USER_ID_KEY, String(id)); }
export async function getUserId() { return AsyncStorage.getItem(USER_ID_KEY); }
export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, EXPIRES_KEY, USER_ID_KEY, CHAT_CACHE_KEY, PLAN_CACHE_KEY]);
}

// ==== Auto-refresh access token (port từ web public/session.js) ====
// Supabase access_token hết hạn sau ~1h. Khi đăng nhập ta lưu thêm refresh_token +
// expires_at rồi tự gọi /auth (action=refresh) TRƯỚC khi hết hạn 5 phút, tránh việc
// người dùng đang thao tác thì bị đá ra vì 401.
const REFRESH_SKEW = 5 * 60; // giây
let _refreshing = null;

async function refreshSession() {
  const rt = await getRefreshToken();
  if (!rt) return false;
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', refresh_token: rt }),
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok || !data?.token) return false;
      await setToken(data.token);
      if (data.refresh_token) await setRefreshToken(data.refresh_token);
      if (data.expires_at) await setExpiresAt(data.expires_at);
      return true;
    } catch {
      return false;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

// Bảo đảm token còn hạn trước mỗi request. true = token vẫn dùng được.
export async function ensureFreshToken() {
  const token = await getToken();
  if (!token) return false;                     // chưa đăng nhập
  const exp = await getExpiresAt();
  if (!exp) return true;                         // đăng nhập kiểu cũ chưa lưu hạn
  const now = Math.floor(Date.now() / 1000);
  if (exp - now > REFRESH_SKEW) return true;     // còn hạn đủ lâu
  return await refreshSession();
}

// ==== Auth-error hook (RootNavigator/AuthProvider sẽ đăng ký) ====
let _onAuthError = null;
export function setOnAuthError(fn) { _onAuthError = fn; }

// ==== Cache helpers ====
export async function getCache(key) {
  try { const s = await AsyncStorage.getItem(key); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
export async function setCache(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ==== fetch với timeout ====
function fetchWithTimeout(url, opts, ms = 30000) {
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); reject(new Error('Hết thời gian chờ máy chủ.')); }, ms);
    fetch(url, { ...opts, signal: ctrl.signal })
      .then((r) => { clearTimeout(timer); resolve(r); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

export async function apiFetch(path, options = {}, _retried = false) {
  // Làm mới token nếu sắp/đã hết hạn trước khi gửi request.
  await ensureFreshToken();
  const token = await getToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const url = `${API_BASE_URL}${path}`;

  let res;
  try {
    res = await fetchWithTimeout(url, { ...options, headers });
  } catch (e1) {
    // retry 1 lần (cold start serverless / mạng chập chờn)
    try {
      await new Promise((r) => setTimeout(r, 800));
      res = await fetchWithTimeout(url, { ...options, headers });
    } catch (e2) {
      throw new Error(e2.message || 'Không thể kết nối máy chủ. Kiểm tra mạng hoặc API URL.');
    }
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (res.status === 401 || res.status === 403) {
    // Thử làm mới token 1 lần rồi gọi lại; nếu vẫn hỏng → clear + báo navigator.
    if (!_retried) {
      const ok = await refreshSession();
      if (ok) return apiFetch(path, options, true);
    }
    await clearAuth();
    if (typeof _onAuthError === 'function') _onAuthError();
    throw new Error((data && (data.error || data.message)) || 'Phiên đăng nhập đã hết hạn.');
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Lỗi ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const AuthAPI = {
  // Web dùng EMAIL thật, không phải username@gmail.com
  login: (emailOrUsername, password) => {
    const email = emailOrUsername.includes('@') ? emailOrUsername : `${emailOrUsername}@gmail.com`;
    return apiFetch('/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', email, password }),
    });
  },
  register: ({ username, email, password, birthYear, weight, height }) => {
    const finalEmail = email || `${username}@gmail.com`;
    return apiFetch('/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'register', email: finalEmail,
        password, username, birthYear, weight, height,
      }),
    });
  },
  logout: () =>
    apiFetch('/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) })
      .catch(() => null), // server lỗi vẫn cho client logout
};

export const StatusAPI = {
  get: () => apiFetch('/status'),
};

export const ChatAPI = {
  // lastMeal: món vừa phân tích đang hiển thị ở thẻ (để backend recall đúng "món gần nhất").
  // lang: 'vi' | 'en' để AI trả lời & hỏi lại đúng ngôn ngữ (giống web).
  send: (message, lastMeal, lang) => {
    const fd = new FormData();
    fd.append('message', message || '');
    if (lastMeal) fd.append('lastClientMeal', typeof lastMeal === 'string' ? lastMeal : JSON.stringify(lastMeal));
    if (lang) fd.append('lang', lang);
    return apiFetch('/chat', { method: 'POST', body: fd });
  },

  // reanalyze=true: đang GỬI LẠI đúng ảnh cũ kèm chỉnh sửa → server bơm ngữ cảnh
  // hội thoại vào vision để phân tích lại. Ảnh mới: bỏ trống → context sạch.
  sendWithImage: async (message, imageUri, lastMeal, lang, reanalyze = false) => {
    const fd = new FormData();
    fd.append('message', message || '');
    if (lastMeal) fd.append('lastClientMeal', typeof lastMeal === 'string' ? lastMeal : JSON.stringify(lastMeal));
    if (lang) fd.append('lang', lang);
    if (reanalyze) fd.append('reanalyze', '1');
    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      fd.append('image', blob, 'photo.jpg');
    } else {
      fd.append('image', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' });
    }
    return apiFetch('/chat', { method: 'POST', body: fd });
  },

  sendMealUpdate: (message, mealData, mealTime, mealDayValue, lang) => {
    const fd = new FormData();
    const displayDate = mealDayValue === 'today' ? 'hôm nay' : mealDayValue;
    fd.append('message', message);
    fd.append('followupType', 'meal_time_update');
    fd.append('mealData', typeof mealData === 'string' ? mealData : JSON.stringify(mealData));
    fd.append('mealTime', mealTime);
    fd.append('mealDayText', displayDate);
    fd.append('mealDayValue', mealDayValue);
    if (lang) fd.append('lang', lang);
    return apiFetch('/chat', { method: 'POST', body: fd });
  },

  // Offline-first: trả cache ngay, đồng thời fetch để caller tự refresh.
  historyCached: () => getCache(CHAT_CACHE_KEY),
  history: async () => {
    const data = await apiFetch('/chat-history');
    const list = Array.isArray(data?.history) ? data.history : (Array.isArray(data) ? data : []);
    await setCache(CHAT_CACHE_KEY, list);
    return list;
  },
};

// /diet-info trả { success, data:{ calories, bmr, tdee, macros:{protein,fat,carbs}, profile } }
export const DietAPI = {
  info: () => apiFetch('/diet-info'),
  // Giữ tương thích ngược: details() cũng gọi /diet-info
  details: () => apiFetch('/diet-info'),
};

export const ScheduleAPI = {
  // Web /api/coach-dynamic chỉ nhận POST. isQueryOnly=true để chỉ đọc, không gen mới.
  getPlan: () => apiFetch('/coach-dynamic', {
    method: 'POST',
    body: JSON.stringify({ isQueryOnly: true }),
  }),
  generate: (payload) =>
    apiFetch('/coach-dynamic', { method: 'POST', body: JSON.stringify(payload || {}) }),
  // Đổi món -> backend tính lại dinh dưỡng món đó & cân đối tuần
  updatePlan: (modifiedMeals) =>
    apiFetch('/coach-dynamic', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_plan', modifiedMeals }),
    }),
  // Ước tính dinh dưỡng 1 món lẻ (dùng cho "Thêm món ngoài thực đơn")
  estimateFood: (food, meal = '') =>
    apiFetch('/coach-dynamic', {
      method: 'POST',
      body: JSON.stringify({ action: 'estimate_food', food, meal }),
    }),
  // Cảnh báo sức khỏe: AI phân tích ăn uống 7 ngày gần nhất, dự đoán xu hướng bệnh
  // days: [{date, calories, protein, fat, carbs, dishes:[..]}]
  healthCheck: (days, lang) =>
    apiFetch('/coach-dynamic', {
      method: 'POST',
      body: JSON.stringify({ action: 'health_check', days, lang }),
    }),
  cached: () => getCache(PLAN_CACHE_KEY),
  setCached: (plan) => setCache(PLAN_CACHE_KEY, plan),
};

// Phân tích ảnh món ăn (dùng cho "Thêm món ngoài thực đơn" qua ảnh)
export const FoodAPI = {
  analyzePhoto: async (imageUri, note = '') => {
    const fd = new FormData();
    if (note) fd.append('note', note);
    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      fd.append('image', blob, 'photo.jpg');
    } else {
      fd.append('image', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' });
    }
    return apiFetch('/analyze-food', { method: 'POST', body: fd });
  },
};

export const SetupAPI = {
  save: (payload) => apiFetch('/setup', { method: 'POST', body: JSON.stringify(payload) }),
};

// D: Nhật ký ảnh món ăn — danh sách ảnh đã phân tích (Cloudinary URL + dinh dưỡng).
export const DiaryAPI = {
  list: (limit = 60) => apiFetch(`/food-diary?limit=${limit}`),
};
