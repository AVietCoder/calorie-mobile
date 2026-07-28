// src/utils/confirm.js
// react-native-web's Alert.alert() là stub RỖNG (xem node_modules/react-native-web/
// dist/cjs/exports/Alert/index.js: `static alert() {}`) — trên web nó không hiện gì
// cả và các callback onPress KHÔNG BAO GIỜ được gọi. Đây là lý do nút "Đăng xuất"
// (và mọi Alert.alert khác) bấm không có phản ứng gì khi chạy bằng `expo start --web`.
// Native (iOS/Android/Expo Go) không bị ảnh hưởng — vẫn dùng đúng Alert.alert.
import { Alert, Platform } from 'react-native';

/**
 * Hộp thoại xác nhận 2 lựa chọn (Huỷ / Xác nhận), chạy đúng trên cả native lẫn web.
 */
export function confirm2(title, message, { confirmText = 'OK', cancelText = 'Huỷ', destructive = false, onConfirm } = {}) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message ? `${title}\n\n${message}` : title)) {
      onConfirm?.();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Hộp thoại thông báo đơn giản (chỉ có nút đóng), chạy đúng trên cả native lẫn web. */
export function alertInfo(title, message) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
