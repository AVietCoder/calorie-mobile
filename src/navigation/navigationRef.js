// src/navigation/navigationRef.js
// Ref điều hướng dùng chung để Trợ lý giọng nói có thể chuyển tab bằng lời nói
// ("mở kế hoạch của tôi") mà không cần prop navigation.
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// Chuyển tới một tab (Diet | Chat | Schedule | Guide | Profile). Trả về true nếu điều
// hướng được — false khi container chưa sẵn sàng hoặc chưa đăng nhập (không có tab đó).
export function navigateToTab(name, params) {
  if (!navigationRef.isReady()) return false;
  try {
    navigationRef.navigate(name, params);
    return true;
  } catch {
    return false;
  }
}
