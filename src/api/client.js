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

/**
 * Xoá dữ liệu CỦA TÀI KHOẢN còn lưu trên máy — dùng khi xoá tài khoản vĩnh viễn.
 *
 * Khác `clearAuth` (chỉ dọn phiên đăng nhập): hàm này gỡ cả khẩu phần đã ăn và
 * danh sách nhắc nhở, vốn lưu theo `<key>_<uid>`. Không lấy uid rồi ghép chuỗi
 * mà quét theo tiền tố, để vẫn chạy đúng khi clearAuth đã xoá mất uid.
 *
 * CỐ Ý GIỮ LẠI `calorie_ai_lang` và các tuỳ chọn giao diện (vị trí nút trợ lý,
 * bật/tắt wake-word): đó là thiết lập của THIẾT BỊ, không phải dữ liệu cá nhân —
 * xoá đi chỉ khiến máy đột ngột đổi về tiếng mặc định mà chẳng bảo vệ được gì.
 */
export async function clearLocalUserData() {
  const OWNED_PREFIXES = ['calorie_ai_intake_', 'calorie_ai_reminders_'];
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter((k) => OWNED_PREFIXES.some((p) => k.startsWith(p)));
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
  } catch {
    /* storage hỏng — tài khoản đã bị xoá ở server nên vẫn an toàn */
  }
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
      // Gắn CỜ chứ không để bên gọi đoán qua nội dung chuỗi: mỗi nền tảng ném
      // một câu khác nhau ("Failed to fetch" trên web, "Network request failed"
      // trên native, "Hết thời gian chờ máy chủ." khi timeout), nên so khớp
      // chuỗi sẽ sai ở đúng lúc cần đúng nhất.
      const err = new Error('Không thể kết nối máy chủ. Kiểm tra mạng hoặc API URL.');
      err.isNetworkError = true;
      err.cause = e2;
      throw err;
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

/** Dấu hiệu "không gọi tới được máy chủ" — apiFetch ném đúng chuỗi này sau khi
 *  đã tự thử lại một lần. Dùng để phân biệt mất mạng với lỗi phía server. */
export const OFFLINE_HINT = 'Không thể kết nối máy chủ';
export const isOfflineError = (err) => String(err?.message || '').includes(OFFLINE_HINT);

export const AccountAPI = {
  /**
   * Xoá tài khoản vĩnh viễn. Server lấy id người dùng TỪ TOKEN, không nhận
   * tham số — nên không có cách nào gửi nhầm id của người khác.
   *
   * Một số WebView/proxy chặn method DELETE; server chấp nhận cả POST kèm
   * action tương đương nên ta lùi về đó thay vì báo hỏng.
   */
  deleteAccount: async () => {
    try {
      return await apiFetch('/account', { method: 'DELETE' });
    } catch (err) {
      if (isOfflineError(err)) throw err;         // mất mạng thì thử lại cũng vô ích
      return apiFetch('/account', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_account' }),
      });
    }
  },
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

  // (TÙY CHỌN — chưa bật) Endpoint tool-calling cho Trợ lý: LLM tự chọn "công cụ" và
  // trả về hành động có cấu trúc. Handler NẰM Ở REPO BACKEND (không có trong workspace
  // mobile này) → client đã sẵn sàng, chỉ bật khi backend triển khai /agent. Hiện tại
  // Trợ lý định tuyến ý định phía client (src/agent/intents.js) nên KHÔNG gọi hàm này.
  agent: (message, context) =>
    apiFetch('/agent', { method: 'POST', body: JSON.stringify({ message, context: context || {} }) }),
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

/* ═══════════════════════════════════════════════════════════════════════════
   Thực đơn gia đình — cùng endpoint /family-menu mà web dùng.
   ═══════════════════════════════════════════════════════════════════════════

   Web gói mọi thứ vào MỘT route: GET phân nhánh theo ?resource=, POST theo
   { action }. Ở đây trải ra thành hàm có tên để màn hình không phải nhớ chuỗi
   ma thuật, nhưng KHÔNG đổi giao thức — sai lệch giữa hai client là nguồn lỗi
   khó tìm nhất khi backend đổi.

   Route trả bao ngoài { success, data }. Ta bóc `data` ngay tại đây để màn
   hình chỉ nhìn thấy dữ liệu thật; lỗi đã được apiFetch ném thành Error rồi.  */
const unwrap = (p) => p.then((r) => (r && typeof r === 'object' && 'data' in r ? r.data : r));
const qs = (o) => Object.entries(o)
  .filter(([, v]) => v != null && v !== '')
  .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
  .join('&');

const post = (action, body = {}) =>
  unwrap(apiFetch('/family-menu', { method: 'POST', body: JSON.stringify({ action, ...body }) }));

export const FamilyMenuAPI = {
  /* ── Hồ sơ gia đình ─────────────────────────────────────────────────────
     Mọi resource thực đơn đều đòi household trước; chưa có thì route trả
     thẳng 400. Nên màn hình phải gọi cái này TRƯỚC. Khi chưa có hộ, response
     vẫn hợp lệ với household: null (không phải lỗi).                        */
  household: () => unwrap(apiFetch('/family-menu?resource=household')),
  createHousehold: (body) => post('create_household', body),
  updateHousehold: (household_id, patch) => post('update_household', { household_id, ...patch }),
  addMember: (household_id, member) => post('add_member', { household_id, ...member }),
  updateMember: (member_id, patch) => post('update_member', { member_id, ...patch }),
  removeMember: (member_id) => post('remove_member', { member_id }),

  /* ── Thư viện thực đơn ──────────────────────────────────────────────── */
  templates: (tag) => unwrap(apiFetch(`/family-menu?${qs({ resource: 'templates', tag })}`)),
  template: (id) => unwrap(apiFetch(`/family-menu?${qs({ resource: 'template', id })}`)),
  /** Đi chợ cho một thực đơn CHƯA áp dụng — để cân nhắc trước khi đổi kế hoạch. */
  templateShoppingList: (id, servings) =>
    unwrap(apiFetch(`/family-menu?${qs({ resource: 'template-shopping-list', id, servings })}`)),

  /* ── Kế hoạch tuần ──────────────────────────────────────────────────── */
  /** Trả null khi hộ chưa có kế hoạch nào đang chạy — không phải lỗi. */
  plan: (household_id) => unwrap(apiFetch(`/family-menu?${qs({ resource: 'plan', household_id })}`)),
  generatePlan: (household_id, template_id) => post('generate_plan', { household_id, template_id }),
  swapDish: (plan_dish_id, replacement_dish_id) =>
    post('swap_dish', { plan_dish_id, replacement_dish_id }),
  regeneratePlan: (plan_id, opts = {}) => post('regenerate_plan', { plan_id, ...opts }),

  /* ── Đi chợ cho kế hoạch đang chạy ──────────────────────────────────── */
  shoppingList: (plan_id, servings) =>
    unwrap(apiFetch(`/family-menu?${qs({ resource: 'shopping-list', plan_id, servings })}`)),
};
