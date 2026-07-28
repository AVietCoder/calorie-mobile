// src/voice/recognizer.js
// BỘ TRỌNG TÀI (arbiter) MỘT-CHỦ-SỞ-HỮU cho engine nhận giọng native.
//
// Vì sao cần: expo-speech-recognition chỉ có MỘT module native singleton
// (ExpoSpeechRecognitionModule). Trước đây mỗi createSpeechSession() tự gắn listener
// và tự gọi start()/stop() trên CÙNG một module → khi có 2 "phiên" cùng sống (vd Trợ lý
// đang nghe-wake + người dùng bấm mic ở Chat), cả hai bộ listener cùng nhận sự kiện →
// transcript BỊ LẶP/nhân đôi, và stop() của phiên này vô tình tắt phiên kia.
//
// Giải pháp: TẤT CẢ nhận giọng đi qua arbiter này. Chỉ MỘT chủ sở hữu (owner) tại một
// thời điểm; xin quyền mới sẽ CHIẾM QUYỀN của chủ cũ (nhả mic sạch sẽ). Listener được gắn
// đúng cho chủ hiện tại và gỡ khi nhả → không còn 2 bộ listener cùng bắn.
//
// Module native → require phòng hờ để app không crash trên Expo Go / build cũ chưa có.
let Speech = null;
try { Speech = require('expo-speech-recognition'); } catch {}
const getMod = () => Speech?.ExpoSpeechRecognitionModule;

export function isRecognizerAvailable() {
  return !!getMod();
}

// Chuẩn hoá transcript + gộp lặp lại phòng hờ (engine đôi khi vọng lại). Hàm THUẦN, test
// được bằng node (xem scripts self-check). Không phụ thuộc \p{L} để an toàn trên Hermes.
export function normalizeTranscript(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';

  // 1) Gộp các TỪ trùng liền kề: "phở phở bò" → "phở bò" (so sánh không phân biệt hoa/thường).
  const words = s.split(' ');
  const collapsed = [];
  for (const w of words) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && prev.toLowerCase() === w.toLowerCase()) continue;
    collapsed.push(w);
  }
  s = collapsed.join(' ');

  // 2) Gộp khi CẢ CÂU bị nhân đôi: "tôi ăn phở tôi ăn phở" → "tôi ăn phở".
  const toks = s.split(' ');
  if (toks.length >= 2 && toks.length % 2 === 0) {
    const half = toks.length / 2;
    const a = toks.slice(0, half).join(' ').toLowerCase();
    const b = toks.slice(half).join(' ').toLowerCase();
    if (a === b) s = toks.slice(0, half).join(' ');
  }

  return s;
}

// Chủ sở hữu hiện tại + listener của chủ đó (đảm bảo bất biến "một-chủ").
let activeSession = null;
let listeners = [];

const detachListeners = () => {
  listeners.forEach((sub) => { try { sub.remove(); } catch {} });
  listeners = [];
};

const hardStop = () => { try { getMod()?.stop(); } catch {} };

// Cho phép các service (vd WakeWordService/Porcupine) BIẾT khi mic được nhả để tiếp tục
// nghe từ khoá đánh thức mà không tranh mic.
const releaseCbs = new Set();
export function onRecognizerReleased(cb) {
  releaseCbs.add(cb);
  return () => releaseCbs.delete(cb);
}
const notifyReleased = () => { releaseCbs.forEach((cb) => { try { cb(); } catch {} }); };

// Ai đang giữ mic (để service khác quyết định có nên tự khởi động lại không).
export function currentOwner() { return activeSession?.owner || null; }

// Tạo một phiên nhận giọng đi qua arbiter. GIỮ NGUYÊN hình dạng API của createSpeechSession
// cũ ({ available, start, stop, cancel }) để ChatScreen & AssistantContext không phải đổi.
//   owner            — nhãn chủ sở hữu ('chat' | 'command' | 'wake') để debug/điều phối
//   onPartial(text)  — kết quả tạm (interim)
//   onFinal(text)    — kết quả cuối (đã CHỐNG LẶP: bỏ final trùng nhau trong 1.5s)
//   onError(code)    — 'not-allowed' | 'no-speech' | 'network' | 'unavailable' | ...
//   onEnd()          — engine kết thúc lắng nghe
export function requestRecognizer({
  owner = 'anon',
  lang = 'vi',
  interimResults = true,
  continuous = false,
  maxAlternatives = 1,          // chỉ lấy phương án tốt nhất → tránh transcript lặp
  contextualStrings,            // gợi ý từ vựng (món ăn/bữa) để tăng độ chính xác
  addsPunctuation,              // thêm dấu câu nếu engine hỗ trợ
  requiresOnDeviceRecognition,  // ưu tiên nhận giọng NGAY TRÊN MÁY (không lên cloud) — dùng
  androidIntentOptions,         //   cho vòng nghe-wake để đỡ hao pin/không gửi audio liên tục
  onPartial,
  onFinal,
  onError,
  onEnd,
} = {}) {
  let released = false;
  let lastFinalNorm = '';
  let lastFinalAt = 0;
  // Chống SỰ KIỆN TRỄ (stale): module native là SINGLETON — sau khi phiên TRƯỚC gọi stop(),
  // engine vẫn có thể bắn 'error: client/aborted' hoặc 'end' MUỘN vài trăm ms; lúc đó phiên
  // MỚI đã gắn listener nên các sự kiện rác này trông như của phiên mới → trước đây chúng
  // GIẾT lượt nói ngay khi vừa mở mic. Nay: trước khi engine xác nhận đã chạy ('start'
  // hoặc 'result' đầu tiên), lỗi tạm thời trong cửa sổ ngắn được RETRY 1 lần thay vì
  // teardown, còn 'end' rác thì bỏ qua.
  let engineStarted = false;
  let startCalledAt = 0;
  let retriedBusy = false;
  const STALE_WINDOW_MS = 900;
  const TRANSIENT = /^(client|aborted|canceled|cancelled|busy|recognizer-busy|service-busy)$/i;

  const session = {
    owner,
    get available() { return isRecognizerAvailable(); },

    async start() {
      const mod = getMod();
      if (!mod) { onError?.('unavailable'); return false; }

      // CHIẾM QUYỀN chủ cũ trước khi xin quyền (nhả mic để không tranh chấp).
      if (activeSession && activeSession !== session) {
        try { activeSession._preempt(); } catch {}
      }

      try {
        const perm = await mod.requestPermissionsAsync();
        if (!perm?.granted) { onError?.('not-allowed'); return false; }
      } catch {
        onError?.('not-allowed');
        return false;
      }

      // Trở thành chủ hiện tại + gắn listener SẠCH (gỡ mọi listener cũ trước).
      released = false;
      activeSession = session;
      detachListeners();

      const startOptions = {
        lang: lang === 'en' ? 'en-US' : 'vi-VN',
        interimResults,
        continuous,
        maxAlternatives,
        ...(contextualStrings && contextualStrings.length ? { contextualStrings } : {}),
        ...(addsPunctuation != null ? { addsPunctuation } : {}),
        ...(requiresOnDeviceRecognition != null ? { requiresOnDeviceRecognition } : {}),
        ...(androidIntentOptions ? { androidIntentOptions } : {}),
      };

      // Engine xác nhận ĐÃ chạy (một số bản lib không bắn 'start' → 'result' đầu cũng tính).
      listeners.push(mod.addListener('start', () => {
        if (released || activeSession !== session) return;
        engineStarted = true;
      }));
      listeners.push(mod.addListener('result', (e) => {
        if (released || activeSession !== session) return;
        engineStarted = true;
        const transcript = normalizeTranscript(e?.results?.[0]?.transcript ?? '');
        onPartial?.(transcript);
        if (e?.isFinal) {
          const now = Date.now();
          // CHỐNG LẶP: bỏ qua final trùng (hoặc gần trùng) trong 1.5s → không xử lý 2 lần.
          if (transcript && transcript === lastFinalNorm && (now - lastFinalAt) < 1500) return;
          lastFinalNorm = transcript;
          lastFinalAt = now;
          onFinal?.(transcript);
        }
      }));
      listeners.push(mod.addListener('error', (e) => {
        if (released || activeSession !== session) return;
        const code = String(e?.error || 'error');
        // Lỗi TẠM THỜI đến TRƯỚC khi engine của TA chạy (trong cửa sổ ngắn sau start()):
        // gần như chắc chắn là sự kiện rác của phiên trước hoặc engine đang bận dọn dẹp →
        // thử start lại ĐÚNG 1 LẦN sau một nhịp, không giết lượt nói.
        if (!engineStarted && !retriedBusy && TRANSIENT.test(code)
            && (Date.now() - startCalledAt) < STALE_WINDOW_MS) {
          retriedBusy = true;
          setTimeout(() => {
            if (released || activeSession !== session || engineStarted) return;
            try { getMod()?.start(startOptions); } catch {
              session._teardown();
              onError?.(code);
            }
          }, 350);
          return;
        }
        session._teardown();
        onError?.(code);
      }));
      listeners.push(mod.addListener('end', () => {
        if (released || activeSession !== session) return;
        // 'end' rác của phiên trước (đến trước khi engine của TA kịp chạy) → bỏ qua để
        // vòng nghe-wake không tưởng nhầm là engine của mình đã dừng.
        if (!engineStarted && (Date.now() - startCalledAt) < STALE_WINDOW_MS) return;
        onEnd?.();
      }));

      try {
        startCalledAt = Date.now();
        mod.start(startOptions);
        return true;
      } catch (e) {
        session._teardown();
        onError?.(e?.message || 'start-failed');
        return false;
      }
    },

    // Gỡ listener + dừng module + nhả quyền (không bắn callback nào).
    _teardown() {
      released = true;
      if (activeSession === session) {
        detachListeners();
        hardStop();
        activeSession = null;
        notifyReleased();
      }
    },

    // Bị chủ khác chiếm quyền — dừng im lặng (không notifyReleased vì chủ mới sắp giữ mic).
    _preempt() {
      released = true;
      if (activeSession === session) {
        detachListeners();
        hardStop();
        activeSession = null;
      }
    },

    stop() { session._teardown(); },
    cancel() { session._teardown(); },
  };

  return session;
}
