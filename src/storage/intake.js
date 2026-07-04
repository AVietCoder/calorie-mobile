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

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// JS: 0=CN..6=T7  →  plan day 1=T2..7=CN
export function todayPlanDay() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export function parseMacro(v) {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
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

export async function setEaten(planDay, meal, val, item) {
  const { all, day } = await getToday();
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
  const { all, day } = await getToday();
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
    const key = d.toISOString().slice(0, 10);
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
