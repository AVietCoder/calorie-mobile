// src/context/AssistantContext.js
// Trợ lý giọng nói — lớp hội thoại chạy trên TOÀN app (mount ở App.js cạnh AlarmModal).
//
// Máy trạng thái: idle → listening → thinking → speaking → idle
//   - listening: nhận giọng (stt) → ra transcript
//   - thinking : định tuyến câu nói → gọi backend (ChatAPI) — TÁI SỬ DỤNG y hệt Chat
//   - speaking : đọc câu trả lời (tts); STT được dừng để trợ lý không "nghe thấy chính nó"
//
// Ghi bữa ăn bằng giọng nói (slot-filling): nếu backend trả về <data> dinh dưỡng, trợ lý
// hỏi "ăn vào bữa nào?" rồi gọi ChatAPI.sendMealUpdate — ĐÚNG luồng meal_time_update mà
// MealSelectionCard của Chat đang dùng, không thêm endpoint mới.
import React, {
  createContext, useContext, useRef, useState, useCallback, useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatAPI, ScheduleAPI, DietAPI, SetupAPI } from '../api/client';
import { useI18n } from '../i18n';
import { useAuth } from './AuthContext';
import { useReminders } from './ReminderContext';
import { createSpeechSession, isSpeechAvailable } from '../voice/stt';
import { ttsSpeak, ttsStop } from '../voice/tts';
import { cleanDisplayContent, extractData } from '../voice/textClean';
import { detectIntent } from '../agent/intents';
import { navigateToTab } from '../navigation/navigationRef';
import { getToday, computeTotals, flattenPlan } from '../storage/intake';
import { wakeAvailable, initWake, startWake, releaseWake } from '../voice/wakeword';

const AssistantContext = createContext(null);

// Cờ bật/tắt chế độ rảnh tay (wake word), lưu theo máy.
const WAKE_KEY = 'assistant_wake_enabled';

// Tên tab → khoá i18n (để đọc tên tab đúng ngôn ngữ khi điều hướng bằng giọng nói).
const TAB_I18N = {
  Diet: 'm.tab_diet', Chat: 'm.tab_chat', Schedule: 'm.tab_plan',
  Guide: 'm.tab_guide', Profile: 'm.tab_profile',
};

// YYYY-MM-DD của hôm nay + offset ngày (dùng cho "hôm qua").
function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// Đọc câu trả lời buổi ăn từ lời nói → { meal (giá trị tiếng Việt backend cần), dayValue }.
// Backend nhận meal ∈ {Sáng,Trưa,Tối,Bữa phụ}; dayValue = 'today' | 'YYYY-MM-DD'.
function parseMealSlot(text) {
  const s = String(text || '').toLowerCase();
  let meal = null;
  if (/breakfast|morning|sáng/.test(s)) meal = 'Sáng';
  else if (/lunch|noon|trưa/.test(s)) meal = 'Trưa';
  else if (/dinner|evening|supper|tối|chiều/.test(s)) meal = 'Tối';
  else if (/snack|bữa phụ|ăn vặt|\bphụ\b/.test(s)) meal = 'Bữa phụ';

  let dayValue = 'today';
  if (/yesterday|hôm qua/.test(s)) dayValue = isoDay(-1);
  return { meal, dayValue };
}

export function AssistantProvider({ children }) {
  const { t, tn, lang } = useI18n();
  const { token } = useAuth();
  const { add: addReminder } = useReminders() || {};

  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [wakeEnabled, setWakeEnabled] = useState(false); // chế độ rảnh tay (wake word)

  const statusRef = useRef('idle');
  const sessionRef = useRef(null);
  const pendingSlotRef = useRef(null); // { type:'meal_time', mealData }
  const lastMealRef = useRef(null);    // = lastClientMeal cho backend recall "món gần nhất"
  const mountedRef = useRef(true);
  const startTurnRef = useRef(null);   // để speak() có thể tự lắng nghe lại (tránh vòng lặp deps)

  const setBoth = useCallback((s) => { statusRef.current = s; setStatus(s); }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    try { sessionRef.current?.stop(); } catch {}
    try { ttsStop(); } catch {}
    releaseWake();
  }, []);

  // Khôi phục cờ rảnh tay đã lưu.
  useEffect(() => {
    (async () => {
      try { const v = await AsyncStorage.getItem(WAKE_KEY); if (v === '1') setWakeEnabled(true); } catch {}
    })();
  }, []);

  // Đọc + về idle khi đọc xong (dừng STT trước để tránh vòng lặp tự nghe).
  // opts.thenListen: tự lắng nghe tiếp sau khi đọc — dùng khi vừa HỎI người dùng để
  // hội thoại liền mạch, rảnh tay.
  const speak = useCallback(async (text, opts = {}) => {
    if (!mountedRef.current) return;
    setReply(text || '');
    setBoth('speaking');
    try { sessionRef.current?.stop(); } catch {}
    await ttsSpeak(text, { lang });
    if (mountedRef.current && statusRef.current === 'speaking') setBoth('idle');
    if (opts.thenListen && mountedRef.current) {
      // Chờ một nhịp để mic không bắt phải đuôi câu vừa đọc.
      setTimeout(() => {
        if (mountedRef.current && statusRef.current === 'idle') startTurnRef.current?.();
      }, 350);
    }
  }, [lang, setBoth]);

  // Ghi bữa ăn qua luồng meal_time_update (giống ChatScreen.handleMealConfirm).
  const logMeal = useCallback(async (mealData, meal, dayValue) => {
    setBoth('thinking');
    const dayText = dayValue === 'today' ? t('meal.today', 'hôm nay') : dayValue;
    const confirmText = `${t('meal.confirm', 'Xác nhận')}: ${meal}, ${dayText}`;
    try {
      const res = await ChatAPI.sendMealUpdate(confirmText, mealData, meal, dayValue, lang);
      if (res?.success) {
        // Đồng bộ thực đơn backend tái cân bằng → màn Kế hoạch cập nhật ngay (giống Chat).
        if (Array.isArray(res?.newPlan) && res.newPlan.length) {
          try { await ScheduleAPI.setCached(res.newPlan); } catch {}
        }
        await speak(cleanDisplayContent(res?.reply) || t('meal.logged', 'Đã ghi lại bữa ăn của bạn!'));
      } else {
        await speak(cleanDisplayContent(res?.reply || res?.error)
          || t('meal.update_fail', 'Mình chưa cập nhật được, bạn thử lại nhé.'));
      }
    } catch (e) {
      await speak(t('assistant.error', 'Xin lỗi, mình gặp chút lỗi. Bạn thử lại nhé.'));
    }
  }, [lang, t, speak, setBoth]);

  // Trả lời "còn bao nhiêu calo / đạm… hôm nay" từ số liệu cục bộ (TÁI SỬ DỤNG computeTotals).
  const answerIntake = useCallback(async (metric) => {
    const diet = await DietAPI.info().catch(() => null);
    const target = diet?.data || {};
    const tgtCal = Number(target.calories) || 0;
    const macros = target.macros || {};

    // Ưu tiên plan đã cache để khỏi gọi mạng; không có thì lấy plan hiện tại.
    let raw = null;
    try { raw = await ScheduleAPI.cached(); } catch {}
    if (!raw) { try { const r = await ScheduleAPI.getPlan(); raw = r?.newPlan || []; } catch { raw = []; } }

    const flat = flattenPlan(raw);
    const { day } = await getToday();
    const totals = computeTotals(day, flat);

    if (metric === 'calories') {
      if (totals.count === 0 && totals.calories === 0) {
        return t('assistant.no_intake',
          'Hôm nay bạn chưa ghi bữa nào. Hãy tick "Đã ăn" ở Kế hoạch hoặc kể cho mình món bạn đã ăn.');
      }
      const remaining = Math.round(tgtCal - totals.calories);
      return remaining >= 0
        ? tn('assistant.calories_left', { n: remaining.toLocaleString() }, `Bạn còn ${remaining} calo cho hôm nay.`)
        : tn('assistant.calories_over', { n: Math.abs(remaining).toLocaleString() }, `Bạn đã vượt ${Math.abs(remaining)} calo hôm nay.`);
    }

    const have = Math.round(totals[metric] || 0);
    const tgt = Math.round(Number(macros[metric]) || 0);
    const macroWord = {
      protein: t('chart.protein', 'Protein'),
      fat: t('chart.fats', 'Chất béo'),
      carbs: t('chart.carbs', 'Carbs'),
    }[metric] || metric;
    return tn('assistant.macro_status', { have, target: tgt, macro: macroWord },
      `Hôm nay bạn đã nạp ${have} trên ${tgt} gam ${macroWord}.`);
  }, [t, tn]);

  // Sửa hồ sơ AN TOÀN: đọc profile hiện tại → ghi lại đầy đủ + đổi đúng 1 trường (không
  // làm mất các trường khác), giống như người dùng lưu lại Hồ sơ với 1 thay đổi.
  const setProfileField = useCallback(async (field, value) => {
    if (!(value >= 20 && value <= 300)) {
      await speak(t('assistant.profile_bad', 'Giá trị đó có vẻ chưa hợp lệ.'));
      return;
    }
    const res = await DietAPI.info().catch(() => null);
    const p = res?.data?.profile;
    if (!p) { await speak(t('assistant.error', 'Xin lỗi, mình gặp chút lỗi. Bạn thử lại nhé.')); return; }

    const src = {
      gender: p.gender, birth_year: p.birth_year, height: p.height, weight: p.weight,
      target_weight: p.target_weight, deadline: p.deadline, speed: p.speed,
      activity: p.activity_level, activity_level: p.activity_level,
      cheat_days: p.high_cal_days, high_cal_days: p.high_cal_days,
      snacking: p.snacking, allergies: p.allergies, focus_macro: p.focus_macro,
      reason: p.reason, goal: p.goal, disease: p.disease,
    };
    const payload = {};
    Object.entries(src).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') payload[k] = v; });
    payload[field] = value;
    await SetupAPI.save(payload);

    const fieldWord = field === 'target_weight'
      ? t('setup.target_weight', 'cân nặng mục tiêu')
      : t('setup.weight', 'cân nặng');
    await speak(tn('assistant.profile_updated', { field: fieldWord, value: `${value} kg` },
      `Đã cập nhật ${fieldWord} thành ${value} kg.`));
  }, [t, tn, speak]);

  // Thực thi một ý định đã nhận diện → gọi các service SẴN CÓ của app (không thêm backend).
  const executeIntent = useCallback(async (intent) => {
    setBoth('thinking');
    try {
      switch (intent.type) {
        case 'navigate': {
          const tabWord = t(TAB_I18N[intent.params.tab] || '', intent.params.tab);
          const ok = navigateToTab(intent.params.tab);
          await speak(ok
            ? tn('assistant.navigated', { tab: tabWord }, `Đã mở ${tabWord}.`)
            : t('assistant.nav_fail', 'Xin lỗi, mình chưa mở được mục đó.'));
          break;
        }
        case 'set_reminder': {
          if (!intent.params.time) {
            await speak(t('assistant.reminder_no_time', 'Bạn muốn nhắc vào lúc mấy giờ?'));
            break;
          }
          if (!addReminder) { await speak(t('assistant.error', 'Xin lỗi, mình gặp chút lỗi.')); break; }
          const remType = intent.params.remType || 'meal';
          const defLabel = {
            water: t('rem.tab_water', 'Uống nước'),
            med: t('rem.tab_med', 'Uống thuốc'),
            meal: t('rem.tab_meal', 'Bữa ăn'),
          }[remType];
          const label = intent.params.label || defLabel;
          await addReminder({ type: remType, label, time: intent.params.time, repeat: true });
          await speak(tn('assistant.reminder_set', { label, time: intent.params.time },
            `Đã đặt nhắc "${label}" lúc ${intent.params.time}.`));
          break;
        }
        case 'query_intake': {
          await speak(await answerIntake(intent.params.metric));
          break;
        }
        case 'regenerate_plan': {
          const res = await ScheduleAPI.generate();
          const raw = res?.newPlan || [];
          if (Array.isArray(raw) && raw.length) {
            try { await ScheduleAPI.setCached(raw); } catch {}
            await speak(t('assistant.plan_regen', 'Đã tạo thực đơn mới cho bạn.'));
          } else {
            await speak(t('assistant.plan_regen_valid', 'Thực đơn tuần này vẫn còn hiệu lực nên mình chưa tạo mới.'));
          }
          break;
        }
        case 'profile_set': {
          await setProfileField(intent.params.field, intent.params.value);
          break;
        }
        default:
          await speak(t('assistant.done', 'Đã xong.'));
      }
    } catch (e) {
      await speak(t('assistant.error', 'Xin lỗi, mình gặp chút lỗi. Bạn thử lại nhé.'));
    }
  }, [t, tn, speak, addReminder, answerIntake, setProfileField, setBoth]);

  // Xử lý một câu nói hoàn chỉnh của người dùng.
  const handleUtterance = useCallback(async (text) => {
    const clean = String(text || '').trim();
    if (!clean) { setBoth('idle'); return; }

    // Đang chờ người dùng cho biết "ăn vào bữa nào" cho món vừa phân tích.
    if (pendingSlotRef.current?.type === 'meal_time') {
      const { meal, dayValue } = parseMealSlot(clean);
      if (meal) {
        const { mealData } = pendingSlotRef.current;
        pendingSlotRef.current = null;
        await logMeal(mealData, meal, dayValue);
        return;
      }
      // Không phải câu trả lời buổi ăn → có thể người dùng đổi ý sang lệnh khác.
      const alt = detectIntent(clean, lang);
      if (alt) { pendingSlotRef.current = null; await executeIntent(alt); return; }
      await speak(t('assistant.ask_meal_time_retry',
        'Bạn ăn vào bữa nào — sáng, trưa, tối hay bữa phụ?'), { thenListen: true });
      return;
    }

    // Ý định "hành động" (đặt nhắc, điều hướng, hỏi số liệu, đổi thực đơn, sửa hồ sơ).
    const intent = detectIntent(clean, lang);
    if (intent) { await executeIntent(intent); return; }

    // Còn lại: câu hỏi/mô tả món ăn → dùng CHUNG endpoint /chat với ChatScreen.
    setBoth('thinking');
    try {
      const res = await ChatAPI.send(clean, lastMealRef.current, lang);
      const raw = res?.reply || res?.message || res?.content || '';
      const display = cleanDisplayContent(raw);
      const data = extractData(raw);

      if (data) {
        // Vừa phân tích được một món → nhớ lại + hỏi bữa để ghi vào nhật ký.
        lastMealRef.current = data;
        pendingSlotRef.current = { type: 'meal_time', mealData: data };
        const ask = t('assistant.ask_meal_time',
          'Bạn ăn món này vào bữa nào — sáng, trưa, tối hay bữa phụ?');
        await speak((display ? `${display} ` : '') + ask, { thenListen: true });
      } else {
        await speak(display || t('assistant.done', 'Đã xong.'));
      }
    } catch (e) {
      await speak(t('assistant.error', 'Xin lỗi, mình gặp chút lỗi. Bạn thử lại nhé.'));
    }
  }, [lang, t, speak, logMeal, executeIntent, setBoth]);

  const handleError = useCallback((code) => {
    const msgs = {
      'not-allowed': t('chat.voice_denied', 'Vui lòng cấp quyền microphone.'),
      'no-speech': t('chat.voice_nospeech', 'Không nghe thấy gì, thử lại nhé.'),
      network: t('chat.voice_neterr', 'Lỗi mạng khi nhận giọng nói.'),
      unavailable: t('chat.voice_unsupported', 'Thiết bị của bạn không hỗ trợ nhận giọng nói.'),
    };
    if (mountedRef.current) setReply(msgs[code] || '');
    setBoth('idle');
  }, [t, setBoth]);

  // Người dùng chạm nút mic → bắt đầu một lượt nói.
  const startTurn = useCallback(() => {
    if (statusRef.current === 'listening' || statusRef.current === 'thinking') return;
    if (!isSpeechAvailable()) { handleError('unavailable'); return; }
    try { ttsStop(); } catch {}
    setReply('');
    setTranscript('');
    setBoth('listening');

    const session = createSpeechSession({
      lang,
      onPartial: (txt) => setTranscript(txt),
      onFinal: (txt) => { setTranscript(txt); try { session.stop(); } catch {} handleUtterance(txt); },
      onError: (code) => { try { session.stop(); } catch {} handleError(code); },
      onEnd: () => {},
    });
    sessionRef.current = session;
    session.start().then((ok) => {
      if (!ok && statusRef.current === 'listening') setBoth('idle');
    });
  }, [lang, handleUtterance, handleError, setBoth]);

  // Đóng/hủy: dừng nghe + dừng đọc + xóa slot chờ.
  const cancel = useCallback(() => {
    try { sessionRef.current?.stop(); } catch {}
    try { ttsStop(); } catch {}
    pendingSlotRef.current = null;
    setTranscript('');
    setBoth('idle');
  }, [setBoth]);

  // Giữ tham chiếu mới nhất tới startTurn cho speak()/wake word (tránh vòng lặp deps).
  useEffect(() => { startTurnRef.current = startTurn; }, [startTurn]);

  // Bật/tắt chế độ rảnh tay ("Hey Calorie"). Trả về trạng thái để UI báo cho người dùng.
  const toggleWake = useCallback(async () => {
    if (!wakeAvailable()) return { ok: false, reason: 'unavailable' };
    const next = !wakeEnabled;
    setWakeEnabled(next);
    try { await AsyncStorage.setItem(WAKE_KEY, next ? '1' : '0'); } catch {}
    return { ok: true, enabled: next };
  }, [wakeEnabled]);

  // Vòng đời wake word: bật khi rảnh-tay ON + đã đăng nhập + khả dụng. Engine chạy liên
  // tục; khi nghe thấy từ khoá mà đang rảnh (idle) mới bắt đầu một lượt nói.
  useEffect(() => {
    let cancelled = false;
    if (wakeEnabled && token && wakeAvailable()) {
      (async () => {
        const ok = await initWake(
          () => { if (statusRef.current === 'idle') startTurnRef.current?.(); },
          () => {},
        );
        if (ok && !cancelled) await startWake();
      })();
    }
    return () => { cancelled = true; releaseWake(); };
  }, [wakeEnabled, token]);

  return (
    <AssistantContext.Provider
      value={{
        status, transcript, reply, startTurn, cancel,
        available: isSpeechAvailable(),
        wakeEnabled, wakeAvailable: wakeAvailable(), toggleWake,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    // Fallback an toàn nếu vô tình dùng ngoài Provider.
    return {
      status: 'idle', transcript: '', reply: '',
      startTurn: () => {}, cancel: () => {}, available: false,
      wakeEnabled: false, wakeAvailable: false, toggleWake: async () => ({ ok: false }),
    };
  }
  return ctx;
}
