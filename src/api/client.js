// src/api/client.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { Platform } from 'react-native';

const TOKEN_KEY = 'calorie_ai_token';
const USER_ID_KEY = 'user_id';
const CHAT_CACHE_KEY = 'chat_history_cache_v1';
const PLAN_CACHE_KEY = 'plan_cache_v1';

export async function setToken(token) { await AsyncStorage.setItem(TOKEN_KEY, token); }
export async function getToken() { return AsyncStorage.getItem(TOKEN_KEY); }
export async function setUserId(id) { await AsyncStorage.setItem(USER_ID_KEY, String(id)); }
export async function getUserId() { return AsyncStorage.getItem(USER_ID_KEY); }
export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY, CHAT_CACHE_KEY, PLAN_CACHE_KEY]);
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

export async function apiFetch(path, options = {}) {
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
    // Token hết hạn → clear + báo navigator
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

export const ChatAPI = {
  send: (message) => {
    const fd = new FormData();
    fd.append('message', message || '');
    return apiFetch('/chat', { method: 'POST', body: fd });
  },

  sendWithImage: async (message, imageUri) => {
    const fd = new FormData();
    fd.append('message', message || '');
    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      fd.append('image', blob, 'photo.jpg');
    } else {
      fd.append('image', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' });
    }
    return apiFetch('/chat', { method: 'POST', body: fd });
  },

  sendMealUpdate: (message, mealData, mealTime, mealDayValue) => {
    const fd = new FormData();
    const displayDate = mealDayValue === 'today' ? 'hôm nay' : mealDayValue;
    fd.append('message', message);
    fd.append('followupType', 'meal_time_update');
    fd.append('mealData', typeof mealData === 'string' ? mealData : JSON.stringify(mealData));
    fd.append('mealTime', mealTime);
    fd.append('mealDayText', displayDate);
    fd.append('mealDayValue', mealDayValue);
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

export const DietAPI = { details: () => apiFetch('/diet-details') };

export const ScheduleAPI = {
  // Web /api/coach-dynamic chỉ nhận POST. isQueryOnly=true để chỉ đọc, không gen mới.
  getPlan: () => apiFetch('/coach-dynamic', {
    method: 'POST',
    body: JSON.stringify({ isQueryOnly: true }),
  }),
  generate: (payload) =>
    apiFetch('/coach-dynamic', { method: 'POST', body: JSON.stringify(payload || {}) }),
  cached: () => getCache(PLAN_CACHE_KEY),
  setCached: (plan) => setCache(PLAN_CACHE_KEY, plan),
};

export const SetupAPI = {
  save: (payload) => apiFetch('/setup', { method: 'POST', body: JSON.stringify(payload) }),
};
