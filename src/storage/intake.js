// src/storage/intake.js
// Theo dõi "Hôm nay đã nạp" — lưu cục bộ theo user + ngày (AsyncStorage).
// Port từ web schedule.html (localStorage) sang mobile.
//   calorie_ai_intake_<uid> = {
//     'YYYY-MM-DD': { eaten:{'<planDay>-<meal>':true}, skipped:{...}, extras:[{...}] }
//   }
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserId } from '../api/client';

async function keyFor() {
  const uid = (await getUserId()) || 'anon';
  return `calorie_ai_intake_${uid}`;
}

/**
 * Khoá ngày "YYYY-MM-DD" theo GIỜ MÁY, không phải UTC.
 *
 * `toISOString()` trả ngày theo UTC. Ở Việt Nam (UTC+7) thì từ 00:00 đến 07:00
 * sáng, ngày UTC vẫn là HÔM QUA — trong khi `todayPlanDay()` ngay dưới lại lấy
 * thứ theo giờ máy. Hai hàm chỉ cùng chỉ về một ngày trong 17/24 giờ.
 *
 * Hậu quả trong khoảng 0h–7h: tick "đã ăn" và món thêm của hôm nay bị ghi vào
 * bản ghi hôm qua, tới 7h sáng khoá ngày nhảy thì chúng "biến mất".
 */
export function dateKeyOf(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayStr() {
  return dateKeyOf(new Date());
}

// JS: 0=CN..6=T7  →  plan day 1=T2..7=CN
export function todayPlanDay() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

/**
 * Ép một trường dinh dưỡng về CHUỖI hiển thị được.
 *
 * Model đôi khi trả macro dạng object `{"unit":"","value":30}` hoặc mảng thay vì
 * chuỗi "30g", và thứ đó được lưu thẳng vào weekly_plan. Render trực tiếp là
 * React ném "Objects are not valid as a React child (found: object with keys
 * {unit, value})" và sập cả màn Kế hoạch.
 *
 * Backend nay đã chuẩn hoá lúc nhập, nhưng các thực đơn ĐÃ LƯU chỉ sạch khi
 * sinh lại — nên vẫn phải chắn ở đây. Mọi chỗ hiển thị macro đều đi qua hàm này.
 */
export function macroText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return macroText(v[0]);
  if (typeof v === 'object') {
    const val = v.value ?? v.amount ?? v.qty;
    if (val == null) return '';
    const unit = String(v.unit ?? '').trim();
    return `${val}${unit}`;
  }
  return String(v);
}

export function parseMacro(v) {
  if (v == null) return 0;
  const n = parseFloat(macroText(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

async function loadAll() {
  try {
    const s = await AsyncStorage.getItem(await keyFor());
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

async function saveAll(all) {
  try { await AsyncStorage.setItem(await keyFor(), JSON.stringify(all)); } catch {}
}

/** Lấy (và chuẩn hoá) object intake của HÔM NAY. */
export async function getToday() {
  const all = await loadAll();
  const k = todayStr();
  if (!all[k]) all[k] = { eaten: {}, skipped: {}, extras: [], eatenInfo: {} };
  if (!all[k].eaten) all[k].eaten = {};
  if (!all[k].skipped) all[k].skipped = {};
  if (!all[k].extras) all[k].extras = [];
  if (!all[k].eatenInfo) all[k].eatenInfo = {};
  return { all, day: all[k] };
}

/**
 * Khoá ngày của planDay (1 = T2 … 7 = CN) TRONG TUẦN HIỆN TẠI.
 * Bảng lộ trình đánh số theo THỨ, kho intake lưu theo NGÀY LỊCH.
 */
export function dateKeyForPlanDay(planDay) {
  const d = new Date();
  d.setDate(d.getDate() + (Number(planDay) - todayPlanDay()));
  return dateKeyOf(d);
}

/** Bản ghi intake của MỘT ngày trong tuần (tạo rỗng nếu chưa có). */
function dayRecord(all, planDay) {
  const k = dateKeyForPlanDay(planDay);
  if (!all[k]) all[k] = { eaten: {}, skipped: {}, extras: [], eatenInfo: {} };
  if (!all[k].eaten) all[k].eaten = {};
  if (!all[k].skipped) all[k].skipped = {};
  if (!all[k].extras) all[k].extras = [];
  if (!all[k].eatenInfo) all[k].eatenInfo = {};
  return all[k];
}

/**
 * Trạng thái đã ăn / bỏ bữa của CẢ TUẦN, gom theo planDay.
 *
 * Sửa lỗi "qua ngày là mất hết món đã ăn": màn Kế hoạch trước đây chỉ nạp bản
 * ghi HÔM NAY rồi tra mọi ngày trong đó, nên tick của hôm qua không còn đường
 * nào đọc lại — dù dữ liệu vẫn nằm nguyên trong bản ghi của ngày hôm qua.
 *
 * @returns {Promise<Record<number,{eaten:object, skipped:object}>>}
 */
export async function getWeekIntake() {
  const all = await loadAll();
  const out = {};
  for (let d = 1; d <= 7; d++) {
    const rec = all[dateKeyForPlanDay(d)] || {};
    out[d] = { eaten: rec.eaten || {}, skipped: rec.skipped || {} };
  }
  return out;
}

export async function setEaten(planDay, meal, val, item) {
  const all = await loadAll();
  const day = dayRecord(all, planDay);
  const key = `${planDay}-${meal}`;
  if (val) {
    day.eaten[key] = true;
    delete day.skipped[key]; // ăn thì không còn "bỏ bữa"
    // SNAPSHOT dinh dưỡng của bữa lúc tick — để thống kê 7 ngày & cảnh báo sức khỏe
    // đọc được số liệu quá khứ dù plan tuần sau đã thay đổi.
    if (item) {
      day.eatenInfo[key] = {
        food: item.food || '',
        calories: parseMacro(item.calories),
        protein: parseMacro(item.protein),
        fat: parseMacro(item.fat),
        carbs: parseMacro(item.carbs),
      };
    }
  } else {
    delete day.eaten[key];
    if (day.eatenInfo) delete day.eatenInfo[key];
  }
  await saveAll(all);
  return day;
}

export async function setSkipped(planDay, meal, val) {
  const all = await loadAll();
  const day = dayRecord(all, planDay);
  const key = `${planDay}-${meal}`;
  if (val) {
    day.skipped[key] = true;
    delete day.eaten[key]; // bỏ bữa thì không tính là đã ăn
  } else {
    delete day.skipped[key];
  }
  await saveAll(all);
  return day;
}

export async function addExtra(item) {
  const { all, day } = await getToday();
  day.extras.push({
    id: 'ex_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    ...item,
  });
  await saveAll(all);
  return day;
}

export async function removeExtra(id) {
  const { all, day } = await getToday();
  day.extras = day.extras.filter((x) => x.id !== id);
  await saveAll(all);
  return day;
}

/**
 * Tổng hợp dữ liệu ăn uống N ngày gần nhất (mặc định 7) cho thống kê tuần &
 * cảnh báo sức khỏe: mỗi ngày = tổng các bữa đã tick (snapshot eatenInfo) + món thêm.
 * @returns [{date:'YYYY-MM-DD', calories, protein, fat, carbs, dishes:[..]}]
 */
export async function getLastDays(n = 7) {
  const all = await loadAll();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // Cùng khoá với chỗ ghi — xem chú thích ở dateKeyOf.
    const key = dateKeyOf(d);
    const rec = all[key] || {};
    const tot = { date: key, calories: 0, protein: 0, fat: 0, carbs: 0, dishes: [] };
    Object.values(rec.eatenInfo || {}).forEach((m) => {
      tot.calories += parseMacro(m.calories);
      tot.protein += parseMacro(m.protein);
      tot.fat += parseMacro(m.fat);
      tot.carbs += parseMacro(m.carbs);
      if (m.food) tot.dishes.push(m.food);
    });
    (rec.extras || []).forEach((ex) => {
      tot.calories += parseMacro(ex.calories);
      tot.protein += parseMacro(ex.protein);
      tot.fat += parseMacro(ex.fat);
      tot.carbs += parseMacro(ex.carbs);
      if (ex.name) tot.dishes.push(ex.name);
    });
    days.push(tot);
  }
  return days;
}

/**
 * Món thêm của CẢ TUẦN hiện tại, gom theo day_index (1 = T2 … 7 = CN).
 *
 * Bảng lộ trình 7 ngày trước đây chỉ vẽ thực đơn do AI sinh, nên món người dùng
 * tự thêm không xuất hiện ở đâu trong bảng — nhìn vào tưởng hôm đó chưa ăn gì
 * ngoài kế hoạch, dù tổng calo và thống kê tuần đều đã tính.
 *
 * Duyệt theo NGÀY LỊCH rồi suy ra thứ, chứ không đọc day_index đã lưu: bản ghi
 * cũ không có trường đó, mà ngày thì luôn nằm ngay ở khoá.
 *
 * @returns {Promise<Record<number, Array>>} vd { 4: [{...}], 5: [{...}] }
 */
export async function getWeekExtras() {
  const all = await loadAll();
  const out = {};
  const today = new Date();
  const todayIdx = todayPlanDay();
  for (let idx = 1; idx <= 7; idx++) {
    const d = new Date(today);
    d.setDate(d.getDate() + (idx - todayIdx));
    const list = all[dateKeyOf(d)]?.extras || [];
    if (list.length) out[idx] = list;
  }
  return out;
}

/**
 * Làm phẳng plan tuần (dạng [{day, meals:[...]}] hoặc [{day, meal, ...}]) thành mảng phẳng
 * [{day, meal, food, calories, protein, fat, carbs, ...}]. Dùng chung cho màn Kế hoạch và
 * Trợ lý giọng nói (trả lời "còn bao nhiêu calo hôm nay").
 */
export function flattenPlan(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((entry) => {
    if (entry && Array.isArray(entry.meals)) {
      entry.meals.forEach((m) => out.push({ ...m, day: Number(entry.day) }));
    } else if (entry && (entry.meal || entry.food)) {
      out.push({ ...entry, day: Number(entry.day) });
    }
  });
  return out;
}

/**
 * Tính tổng đã nạp hôm nay = các bữa (thuộc plan-day hôm nay) đã tick + món thêm.
 * @param {Array} flatPlan mảng phẳng [{day, meal, calories, protein, fat, carbs}]
 */
export function computeTotals(dayIntake, flatPlan) {
  const tot = { calories: 0, protein: 0, fat: 0, carbs: 0, count: 0 };
  const pday = todayPlanDay();
  (flatPlan || []).forEach((item) => {
    if (Number(item.day) !== pday) return;
    if (!dayIntake?.eaten?.[`${pday}-${item.meal}`]) return;
    tot.calories += parseMacro(item.calories);
    tot.protein += parseMacro(item.protein);
    tot.fat += parseMacro(item.fat);
    tot.carbs += parseMacro(item.carbs);
    tot.count++;
  });
  (dayIntake?.extras || []).forEach((ex) => {
    tot.calories += parseMacro(ex.calories);
    tot.protein += parseMacro(ex.protein);
    tot.fat += parseMacro(ex.fat);
    tot.carbs += parseMacro(ex.carbs);
    tot.count++;
  });
  return tot;
}
