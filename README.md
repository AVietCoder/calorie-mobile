# Calorie AI — Mobile App (Expo / React Native)

App mobile đầy đủ tính năng cho Calorie AI: Đăng nhập / Đăng ký / Diet (charts) / Chat AI / Kế hoạch 7 ngày / Hướng dẫn / Hồ sơ.

## 🎨 Design
- Tông màu **Sage & Cream** (đồng bộ với web)
- Font hệ thống (Inter-like) — cài thêm `expo-google-fonts/inter` nếu muốn font Inter chuẩn
- Bottom Tabs (5 tab) + Stack auth riêng

## 🚀 Cài đặt & chạy

```bash
npm install
npx expo start
```

Quét mã QR bằng app **Expo Go** (iOS/Android), hoặc:
- `npm run android` — emulator Android
- `npm run ios` — simulator iOS (macOS)

## 🔌 API

File `src/api/config.js` tự đổi base URL theo môi trường:

| Môi trường | URL |
|---|---|
| Dev (Android emulator) | `http://10.0.2.2:3000/api` |
| Dev (iOS sim / web) | `http://localhost:3000/api` |
| Production | `https://tht-d3.vercel.app/api` |

Endpoints sử dụng (giống web HTML/CSS/JS gốc):
- `POST /auth` — `{ action: 'login' | 'register', email, password, ... }`
- `POST /chat` — gửi tin nhắn
- `GET  /chat-history` — lịch sử chat
- `GET  /diet-details` — chỉ số dinh dưỡng + macro + lịch sử cân
- `GET/POST /coach-dynamic` — kế hoạch 7 ngày
- `POST /setup` — cập nhật profile

> Token JWT lưu trong **AsyncStorage** với key `calorie_ai_token`, gắn vào header `Authorization: Bearer <token>` ở mọi request.

## 📁 Cấu trúc

```
calorie-ai-mobile/
├─ App.js                    # Root, providers
├─ index.js
├─ app.json                  # Expo config
├─ babel.config.js
├─ package.json
└─ src/
   ├─ api/
   │  ├─ config.js           # Base URL auto-switch
   │  └─ client.js           # apiFetch + AuthAPI/ChatAPI/DietAPI/...
   ├─ components/
   │  ├─ Toast.js            # Toast message giống web
   │  └─ UI.js               # Card / Button / Field / Pill...
   ├─ context/
   │  └─ AuthContext.js      # Quản lý token + user
   ├─ navigation/
   │  └─ RootNavigator.js    # Auth Stack vs Main Tabs
   ├─ screens/
   │  ├─ SignInScreen.js
   │  ├─ SignUpScreen.js
   │  ├─ DietScreen.js       # 4 charts: Pie / Line / Bar / Progress
   │  ├─ ChatScreen.js
   │  ├─ ScheduleScreen.js
   │  ├─ GuideScreen.js
   │  └─ ProfileScreen.js
   └─ theme/
      └─ colors.js           # Sage & Cream tokens
```

## 📦 Phụ thuộc chính
- `expo` 51, `react-native` 0.74
- `@react-navigation/{native,bottom-tabs,native-stack}`
- `react-native-chart-kit` + `react-native-svg` (biểu đồ)
- `@react-native-async-storage/async-storage` (lưu token)
- `expo-linear-gradient` (hero gradient)

## 🛠️ Tuỳ chỉnh
- Đổi base URL: sửa `src/api/config.js` (`PROD_URL` / `DEV_URL`)
- Đổi tông màu: sửa `src/theme/colors.js`
- Thêm endpoint mới: thêm vào `src/api/client.js`

## 📱 Tính năng
- ✅ Auth: Đăng nhập / Đăng ký với toast feedback
- ✅ Auto-login khi mở app nếu còn token
- ✅ Diet: 4 biểu đồ (Macro donut, Weight line, Calo bar, BMR/TDEE)
- ✅ Chat: AI streaming feel + lịch sử
- ✅ Schedule: 7 ngày + nút "Tạo mới" (regenerate)
- ✅ Guide: hướng dẫn từng tab + FAQ
- ✅ Profile: cập nhật chỉ số + đăng xuất
- ✅ Pull-to-refresh ở Diet & Schedule
- ✅ Fallback mock data nếu API chưa sẵn

## ⚠️ Ghi chú
- Nếu API yêu cầu CORS riêng cho mobile thì không cần bật — React Native không bị chặn CORS.
- Token expire → app tự logout khi nhận 401.
- Nếu muốn font Inter chuẩn: `npx expo install @expo-google-fonts/inter expo-font` và load trong `App.js`.
