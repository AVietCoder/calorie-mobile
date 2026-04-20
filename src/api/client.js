import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { Platform } from 'react-native';

const TOKEN_KEY = 'calorie_ai_token';
const USER_ID_KEY = 'user_id';

export async function setToken(token) { await AsyncStorage.setItem(TOKEN_KEY, token); }
export async function getToken() { return AsyncStorage.getItem(TOKEN_KEY); }
export async function setUserId(id) { await AsyncStorage.setItem(USER_ID_KEY, String(id)); }
export async function getUserId() { return AsyncStorage.getItem(USER_ID_KEY); }
export async function clearAuth() { await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY]); }

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
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    throw new Error('Không thể kết nối máy chủ. Kiểm tra mạng hoặc API URL.');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Lỗi ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const AuthAPI = {
  login: (username, password) =>
    apiFetch('/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', email: `${username}@gmail.com`, password }),
    }),
  register: ({ username, password, birthYear, weight, height }) =>
    apiFetch('/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'register', email: `${username}@gmail.com`,
        password, username, birthYear, weight, height,
      }),
    }),
};

export const ChatAPI = {
  /* Gửi text bình thường — KHỚP web: dùng FormData */
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
    fd.append('image', {
      uri: imageUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
  }

  return apiFetch('/chat', {
    method: 'POST',
    body: fd,
  });
},

  /* Cập nhật bữa ăn — KHỚP web: đầy đủ mealDayText + mealDayValue */
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

  history: async () => {
    const data = await apiFetch('/chat-history');
    // Web trả về { history: [...] } — unwrap cho khớp
    if (data && Array.isArray(data.history)) return data.history;
    return Array.isArray(data) ? data : [];
  },
};

export const DietAPI = { details: () => apiFetch('/diet-details') };

export const ScheduleAPI = {
  getPlan: () => apiFetch('/coach-dynamic'),
  generate: (payload) =>
    apiFetch('/coach-dynamic', { method: 'POST', body: JSON.stringify(payload || {}) }),
};

export const SetupAPI = {
  save: (payload) => apiFetch('/setup', { method: 'POST', body: JSON.stringify(payload) }),
};
