import { Platform, NativeModules } from 'react-native';

// =============================================================================
//  Base URL của backend (chứa LLM/Qwen qua vLLM). App LUÔN gọi backend, không
//  gọi thẳng vLLM. Muốn "app dùng Qwen local" => chạy backend calorie-main ở
//  local với LLM_BASE_URL trỏ tới vLLM local, rồi để app trỏ vào backend đó.
//
//  Thứ tự ưu tiên chọn URL:
//    1) EXPO_PUBLIC_API_BASE_URL  — override tường minh (khuyên dùng khi cần).
//    2) DEV: tự dò IP LAN của máy chạy Metro (chạy được trên điện thoại thật).
//    3) PROD: Vercel deploy.
// =============================================================================

const PROD_URL = 'https://tht-d3.vercel.app/api';

// Cổng backend local (vercel dev mặc định 3000). Đổi nếu bạn chạy cổng khác.
const BACKEND_PORT = process.env.EXPO_PUBLIC_BACKEND_PORT || '3000';

// (1) Override tường minh — tạo file .env ở gốc app:
//     EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000/api
const ENV_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// (2) Dò IP máy chạy Metro từ URL bundle (vd "http://192.168.1.10:8081/index.bundle").
//     Trên điện thoại thật, host này chính là máy dev — nơi backend local chạy.
function inferMetroHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const m = scriptURL.match(/^https?:\/\/([^/:]+)/);
    if (m && m[1]) return m[1];
  } catch {}
  return null;
}

function devUrl() {
  const host = inferMetroHost();
  // Nếu dò được IP LAN thật (không phải localhost) -> dùng nó cho cả emulator lẫn máy thật.
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${BACKEND_PORT}/api`;
  }
  // Fallback khi không dò được host:
  // - Android emulator: 10.0.2.2 ánh xạ tới localhost của máy host.
  // - iOS sim / web:    localhost.
  return Platform.select({
    android: `http://10.0.2.2:${BACKEND_PORT}/api`,
    ios: `http://localhost:${BACKEND_PORT}/api`,
    default: `http://localhost:${BACKEND_PORT}/api`,
  });
}

export const API_BASE_URL = ENV_URL || (PROD_URL);
