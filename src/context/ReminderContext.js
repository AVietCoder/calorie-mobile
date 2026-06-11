// src/context/ReminderContext.js
// Nhắc nhở bữa ăn / uống thuốc — port từ web reminders.js.
// Web chỉ bắn khi tab đang mở; mobile cũng vậy: bộ đếm chạy khi app foreground,
// đến đúng phút sẽ hiện chuông báo nổi giữa màn hình + rung.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Vibration } from 'react-native';
import { loadReminders, saveReminders, addReminder, deleteReminder } from '../storage/reminders';
import { useAuth } from './AuthContext';

const ReminderContext = createContext(null);

export function ReminderProvider({ children }) {
  const { token } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [alarm, setAlarm] = useState(null); // reminder đang kêu (hiện modal)
  const firedRef = useRef({}); // { 'YYYY-MM-DD_HH:MM_id': true }
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    const list = await loadReminders();
    setReminders(list);
    return list;
  }, []);

  // Nạp lại danh sách mỗi khi đăng nhập/đăng xuất
  useEffect(() => {
    if (token) refresh();
    else { setReminders([]); setAlarm(null); }
  }, [token, refresh]);

  const add = useCallback(async (payload) => {
    const list = await addReminder(payload);
    setReminders(list);
    return list;
  }, []);

  const remove = useCallback(async (id) => {
    const list = await deleteReminder(id);
    setReminders(list);
    return list;
  }, []);

  const dismissAlarm = useCallback(() => {
    Vibration.cancel();
    setAlarm(null);
  }, []);

  const fire = useCallback((rem) => {
    try { Vibration.vibrate([0, 400, 200, 400]); } catch {}
    setAlarm(rem);
  }, []);

  // Bộ đếm: mỗi 20s kiểm tra có nhắc nhở nào tới giờ không
  useEffect(() => {
    if (!token) return undefined;

    const tick = async () => {
      const list = await loadReminders();
      if (!list.length) return;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const cur = `${hh}:${mm}`;
      const dateKey = now.toISOString().slice(0, 10);

      for (const r of list) {
        if (!r.time || r.time !== cur) continue;
        const fkey = `${dateKey}_${cur}_${r.id}`;
        if (firedRef.current[fkey]) continue;
        firedRef.current[fkey] = true;
        fire(r);
        // Không lặp lại -> xoá sau khi nhắc
        if (!r.repeat) {
          const next = (await loadReminders()).filter((x) => x.id !== r.id);
          await saveReminders(next);
          setReminders(next);
        }
      }
    };

    const start = () => {
      if (timerRef.current) return;
      tick();
      timerRef.current = setInterval(tick, 20000);
    };
    const stop = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });

    return () => { stop(); sub.remove(); };
  }, [token, fire]);

  return (
    <ReminderContext.Provider
      value={{ reminders, refresh, add, remove, alarm, dismissAlarm }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export const useReminders = () => useContext(ReminderContext);
