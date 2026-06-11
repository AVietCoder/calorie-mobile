// src/storage/reminders.js
// Danh sách nhắc nhở (bữa ăn / uống thuốc) lưu theo user — port từ web reminders.js.
//   calorie_ai_reminders_<uid> = [{ id, type:'meal'|'med', label, time:'HH:MM', repeat:boolean }]
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserId } from '../api/client';

async function keyFor() {
  const uid = (await getUserId()) || 'anon';
  return `calorie_ai_reminders_${uid}`;
}

function uid() {
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function loadReminders() {
  try {
    const s = await AsyncStorage.getItem(await keyFor());
    const arr = s ? JSON.parse(s) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveReminders(list) {
  try { await AsyncStorage.setItem(await keyFor(), JSON.stringify(list)); } catch {}
}

export async function addReminder({ type, label, time, repeat }) {
  const list = await loadReminders();
  list.push({ id: uid(), type, label, time, repeat: !!repeat });
  await saveReminders(list);
  return list;
}

export async function deleteReminder(id) {
  const list = (await loadReminders()).filter((x) => x.id !== id);
  await saveReminders(list);
  return list;
}
