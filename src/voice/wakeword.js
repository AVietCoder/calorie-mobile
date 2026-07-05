// src/voice/wakeword.js
// Từ khoá đánh thức rảnh tay ("Hey Calorie") qua Picovoice Porcupine.
//
// CHỈ chạy trên EAS dev/prod build (KHÔNG chạy Expo Go — cần native module). Điều kiện:
//   1) Native module đã có trong package.json:
//        @picovoice/porcupine-react-native + @picovoice/react-native-voice-processor
//   2) AccessKey (miễn phí ở https://console.picovoice.ai) đặt trong .env:
//        EXPO_PUBLIC_PICOVOICE_ACCESS_KEY=xxxxx
//   3) (Tuỳ chọn) Tạo từ khoá riêng "Hey Calorie" trên Console → tải file .ppn theo nền
//      tảng → khai báo ở CUSTOM_KEYWORD_PATHS. Chưa có thì dùng từ khoá dựng sẵn (mặc
//      định "jarvis", đổi qua EXPO_PUBLIC_WAKEWORD_BUILTIN, vd COMPUTER/BUMBLEBEE...).
//
// Thiếu bất kỳ điều kiện nào ở trên → wakeAvailable() = false → tính năng TỰ TẮT; app vẫn
// chạy bình thường, nút mic "chạm để nói" (Phase 1) vẫn hoạt động.
let PV = null;
try { PV = require('@picovoice/porcupine-react-native'); } catch {}

const ACCESS_KEY = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY || '';
const BUILTIN = (process.env.EXPO_PUBLIC_WAKEWORD_BUILTIN || 'JARVIS').toUpperCase();

// Có "Hey Calorie".ppn rồi thì điền đường dẫn theo nền tảng, vd:
//   Platform.OS === 'ios' ? ['hey-calorie_ios.ppn'] : ['hey-calorie_android.ppn']
const CUSTOM_KEYWORD_PATHS = [];

let manager = null;
let starting = false;

export function wakeAvailable() {
  return !!(PV?.PorcupineManager && ACCESS_KEY);
}

export async function initWake(onWake, onError) {
  if (!wakeAvailable() || manager) return !!manager;
  try {
    const { PorcupineManager, BuiltInKeywords } = PV;
    const onDetect = () => { try { onWake?.(); } catch {} };
    const onErr = (e) => { try { onError?.(e?.message || String(e)); } catch {} };
    if (CUSTOM_KEYWORD_PATHS.length) {
      manager = await PorcupineManager.fromKeywordPaths(ACCESS_KEY, CUSTOM_KEYWORD_PATHS, onDetect, onErr);
    } else {
      const kw = BuiltInKeywords[BUILTIN] || BuiltInKeywords.JARVIS;
      manager = await PorcupineManager.fromBuiltInKeywords(ACCESS_KEY, [kw], onDetect, onErr);
    }
    return true;
  } catch (e) {
    onError?.(e?.message || String(e));
    manager = null;
    return false;
  }
}

export async function startWake() {
  if (!manager || starting) return;
  starting = true;
  try { await manager.start(); } catch {} finally { starting = false; }
}

export async function stopWake() {
  if (!manager) return;
  try { await manager.stop(); } catch {}
}

export async function releaseWake() {
  try { await stopWake(); await manager?.delete?.(); } catch {}
  manager = null;
}
