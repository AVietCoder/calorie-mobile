// src/context/ReminderContext.js
// Nhắc nhở bữa ăn / uống thuốc — port từ web reminders.js.
// Web chỉ bắn khi tab đang mở; mobile cũng vậy: bộ đếm chạy khi app foreground,
// đến đúng phút sẽ hiện chuông báo nổi giữa màn hình + rung.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { loadReminders, saveReminders, addReminder, deleteReminder } from '../storage/reminders';
import { useAuth } from './AuthContext';
import { useI18n } from '../i18n';

// Notification hệ thống (web dùng Notification API của trình duyệt) — require phòng hờ
// để app không crash trên build cũ chưa có native module.
let Notifications = null;
try { Notifications = require('expo-notifications'); } catch {}

if (Notifications) {
  // Khi app đang MỞ: chuông báo nổi + rung đã hiển thị (giống web) → không hiện banner đôi.
  // Khi app chạy nền/tắt: hệ thống tự hiện notification đã lên lịch.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('reminders', {
      name: 'Nhắc nhở',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
    }).catch(() => {});
  }
}

const ReminderContext = createContext(null);

export function ReminderProvider({ children }) {
  const { token } = useAuth();
  const { t } = useI18n();
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

  // Lên lịch notification hệ thống cho 1 nhắc nhở (repeat = hằng ngày; không repeat =
  // 1 lần vào lần tới của giờ đó). Trả về notifId để hủy khi xóa.
  const scheduleNotif = useCallback(async (rem) => {
    if (!Notifications || !rem?.time) return null;
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) return null;
      const [h, m] = String(rem.time).split(':').map(Number);
      const channel = Platform.OS === 'android' ? { channelId: 'reminders' } : {};
      const trigger = rem.repeat
        ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m, ...channel }
        : (() => {
            const d = new Date();
            d.setHours(h, m, 0, 0);
            if (d <= new Date()) d.setDate(d.getDate() + 1);
            return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d, ...channel };
          })();
      const isMed = rem.type === 'med';
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: isMed ? t('rem.fire_med', '💊 Đến giờ uống thuốc') : t('rem.fire_meal', '🍽️ Đến giờ ăn'),
          body: rem.label
            || (isMed ? t('rem.alarm_default_med', 'Đã đến giờ uống thuốc của bạn.')
                      : t('rem.alarm_default_meal', 'Đã đến giờ ăn của bạn.')),
        },
        trigger,
      });
    } catch { return null; }
  }, [t]);

  const cancelNotif = useCallback(async (rem) => {
    if (!Notifications || !rem?.notifId) return;
    try { await Notifications.cancelScheduledNotificationAsync(rem.notifId); } catch {}
  }, []);

  const add = useCallback(async (payload) => {
    const list = await addReminder(payload);
    const rem = list[list.length - 1];
    const notifId = await scheduleNotif(rem);
    if (notifId) {
      rem.notifId = notifId;
      await saveReminders(list);
    }
    setReminders(list);
    return list;
  }, [scheduleNotif]);

  const remove = useCallback(async (id) => {
    const cur = await loadReminders();
    await cancelNotif(cur.find((x) => x.id === id));
    const list = await deleteReminder(id);
    setReminders(list);
    return list;
  }, [cancelNotif]);

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
        // Không lặp lại -> xoá sau khi nhắc (kèm hủy notification hệ thống nếu có)
        if (!r.repeat) {
          await cancelNotif(r);
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
  }, [token, fire, cancelNotif]);

  return (
    <ReminderContext.Provider
      value={{ reminders, refresh, add, remove, alarm, dismissAlarm }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export const useReminders = () => useContext(ReminderContext);
