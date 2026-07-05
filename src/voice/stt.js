// src/voice/stt.js
// Lớp nhận giọng nói (Speech-to-Text) dùng CHUNG cho Chat và Trợ lý giọng nói.
// Trích nguyên logic expo-speech-recognition đang nằm trong ChatScreen ra một chỗ để
// hai nơi cùng dùng — KHÔNG đổi hành vi nhận giọng của Chat.
//
// Module native → require phòng hờ để app không crash trên Expo Go / build cũ chưa có.
let Speech = null;
try { Speech = require('expo-speech-recognition'); } catch {}

export function isSpeechAvailable() {
  return !!Speech?.ExpoSpeechRecognitionModule;
}

// Tạo một "phiên" nhận giọng. Callback:
//   onPartial(text) — kết quả tạm thời (interim) khi đang nói
//   onFinal(text)   — kết quả cuối (isFinal); người gọi tự quyết định dừng/gửi
//   onError(code)   — mã lỗi: 'not-allowed' | 'no-speech' | 'network' | 'unavailable' | ...
//   onEnd()         — engine kết thúc lắng nghe
export function createSpeechSession({
  lang = 'vi',
  interimResults = true,
  continuous = false,
  onPartial,
  onFinal,
  onError,
  onEnd,
} = {}) {
  const mod = Speech?.ExpoSpeechRecognitionModule;
  let subs = [];

  const clearSubs = () => {
    subs.forEach((s) => { try { s.remove(); } catch {} });
    subs = [];
  };

  const stop = () => {
    clearSubs();
    try { mod?.stop(); } catch {}
  };

  return {
    available: !!mod,

    async start() {
      if (!mod) { onError?.('unavailable'); return false; }
      try {
        const perm = await mod.requestPermissionsAsync();
        if (!perm?.granted) { onError?.('not-allowed'); return false; }
      } catch {
        onError?.('not-allowed');
        return false;
      }

      clearSubs();
      subs.push(mod.addListener('result', (e) => {
        const transcript = (e.results || []).map((r) => r.transcript).join('');
        onPartial?.(transcript);
        if (e.isFinal) onFinal?.(transcript);
      }));
      subs.push(mod.addListener('error', (e) => { stop(); onError?.(e?.error || 'error'); }));
      subs.push(mod.addListener('end', () => { onEnd?.(); }));

      try {
        mod.start({
          lang: lang === 'en' ? 'en-US' : 'vi-VN',
          interimResults,
          continuous,
        });
        return true;
      } catch (e) {
        stop();
        onError?.(e?.message || 'start-failed');
        return false;
      }
    },

    stop,
    cancel() { stop(); },
  };
}
