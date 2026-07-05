// src/voice/tts.js
// Lớp đọc văn bản (Text-to-Speech) cho Trợ lý giọng nói — dùng expo-speech (trên máy,
// miễn phí, không cần mạng). Module require phòng hờ để không crash nếu chưa cài.
import { stripForSpeech } from './textClean';

let Speech = null;
try { Speech = require('expo-speech'); } catch {}

export function ttsAvailable() { return !!Speech; }

export function ttsStop() {
  try { Speech?.stop(); } catch {}
}

// Đọc text. Trả về Promise resolve khi đọc xong / bị dừng / lỗi — để turn-loop chờ được.
export function ttsSpeak(text, { lang = 'vi', onStart, onDone, onError } = {}) {
  return new Promise((resolve) => {
    const clean = stripForSpeech(text);
    if (!Speech || !clean) { try { onDone?.(); } catch {} resolve(); return; }

    let settled = false;
    const finish = (cb) => {
      if (settled) return;
      settled = true;
      try { cb?.(); } catch {}
      resolve();
    };

    try {
      Speech.stop(); // dừng câu đang đọc dở (nếu có) trước khi đọc câu mới
      Speech.speak(clean, {
        language: lang === 'en' ? 'en-US' : 'vi-VN',
        onStart: () => { try { onStart?.(); } catch {} },
        onDone: () => finish(onDone),
        onStopped: () => finish(onDone),
        onError: () => finish(onError || onDone),
      });
    } catch (e) {
      finish(onError || onDone);
    }
  });
}
