// app.config.js — cấu hình động BỌC QUANH app.json (app.json vẫn là nguồn chính).
//
// Expo CLI nạp file .env vào process.env TRƯỚC khi chạy file này, nên các biến
// LLM_* (kéo về bằng `vercel env pull`, KHÔNG có tiền tố EXPO_PUBLIC_) vẫn đọc
// được ở đây. Ta nhúng chúng vào `extra` để client (src/api/llm.js) gọi THẲNG
// server vLLM — không đi qua backend Vercel (gói Hobby giết request ở 60s).
//
// Đổi giá trị trong .env xong phải khởi động lại Metro (`npx expo start -c`)
// vì `extra` được chốt lúc load config, không tự cập nhật nóng.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    LLM_BASE_URL: process.env.LLM_BASE_URL || null,
    LLM_API_KEY: process.env.LLM_API_KEY || null,
    LLM_MODEL: process.env.LLM_MODEL || null,
  },
});
