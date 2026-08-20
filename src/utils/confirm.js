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

/**
 * Bản Promise của hộp thoại xác nhận — `await` được, để luồng "hỏi rồi gọi API"
 * viết thẳng một mạch thay vì lồng callback.
 *
 * Chỉ resolve(true) khi người dùng bấm xác nhận; huỷ hoặc bấm ra ngoài đều ra
 * false, nên `if (!(await confirmAction(...))) return;` là đủ an toàn.
 *
 * KHÔNG cài bằng cách bọc confirm2 rồi hẹn giờ trả false: Alert.alert của native
 * là bất đồng bộ, hẹn giờ sẽ chốt false ngay trước khi người dùng kịp chạm, và
 * hành động không bao giờ chạy. Phải bắt CẢ nút huỷ lẫn sự kiện đóng.
 */
export function confirmAction({ title, message, confirmText = 'OK', cancelText = 'Huỷ', destructive = false }) {
  if (Platform.OS === 'web') {
    // window.confirm chặn luồng và trả thẳng kết quả — không cần chờ gì.
    const okToGo = typeof window !== 'undefined'
      && window.confirm(message ? `${title}\n\n${message}` : title);
    return Promise.resolve(!!okToGo);
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => done(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => done(true) },
      ],
      // Android cho phép bấm ra ngoài để đóng; không có onDismiss thì Promise
      // treo mãi và màn hình kẹt ở trạng thái "đang chờ".
      { cancelable: true, onDismiss: () => done(false) }
    );
  });
}

/** Hộp thoại thông báo đơn giản (chỉ có nút đóng), chạy đúng trên cả native lẫn web. */
export function alertInfo(title, message) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
