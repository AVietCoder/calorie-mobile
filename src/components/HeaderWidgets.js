// src/components/HeaderWidgets.js
// Nút đổi ngôn ngữ (VI/EN) + chuông nhắc nhở dùng chung trên header các màn hình.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme/colors';
import { useI18n } from '../i18n';
import { useReminders } from '../context/ReminderContext';
import { ReminderManager } from './ReminderModal';

export function LangSwitch({ style }) {
  const { lang, setLang } = useI18n();
  return (
    <View style={[styles.langWrap, style]}>
      {['vi', 'en'].map((l) => {
        const active = lang === l;
        return (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            // borderless: false — BẮT BUỘC. Với borderless: true, Android tạo
            // RippleDrawable KHÔNG có mask nên vệt ripple vẽ tràn ra ngoài viên
            // pill, phủ luôn sang viên bên cạnh. Màu ripple là chính màu thương
            // hiệu, nên viên KHÔNG được chọn cũng bị nhuộm xanh y hệt viên đang
            // chọn — nhìn như cả VI lẫn EN cùng active.
            android_ripple={{ color: 'rgba(88,166,119,0.22)', borderless: false }}
            style={({ pressed }) => [
              styles.langOpt,
              active && styles.langOptActive,
              pressed && !active && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.langText, active && styles.langTextActive]}>{l.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReminderBell({ color = colors.textMain, size = 22 }) {
  const { reminders } = useReminders() || { reminders: [] };
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true, radius: 22 }}
        style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="notifications-outline" size={size} color={color} />
        {reminders.length > 0 && (
          <View style={styles.dot}>
            <Text style={styles.dotText}>{reminders.length > 9 ? '9+' : reminders.length}</Text>
          </View>
        )}
      </Pressable>
      <ReminderManager visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  langWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    padding: 3,
    // Cắt mọi thứ vẽ lọt ra ngoài khung (ripple, bóng của viên đang chọn) —
    // chốt chặn cuối để không bao giờ lem sang viên bên cạnh nữa.
    overflow: 'hidden',
  },
  langOpt: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.full,
    minWidth: 36,
    alignItems: 'center',
    // Đặt tường minh thay vì dựa vào "không khai báo": khi đổi qua lại giữa hai
    // viên, style cũ chắc chắn bị ghi đè chứ không sót lại nền xanh.
    backgroundColor: 'transparent',
  },
  langOptActive: {
    backgroundColor: colors.primary,
    // KHÔNG dùng elevation ở đây. Trên Android elevation vẽ bóng thật RA NGOÀI
    // biên view; hai viên chỉ cách nhau vài px nên bóng đổ thẳng sang viên kia,
    // làm nó trông cũng có nền. Ngoài ra shadowOffset/Opacity/Radius chỉ có tác
    // dụng trên iOS, còn shadowColor thì Android phải từ API 28 mới nhận — nên
    // bộ thuộc tính cũ vốn không vẽ ra đúng thứ nó định vẽ. Nền xanh đặc so với
    // nền trong suốt đã đủ tương phản cho một segmented control 2 lựa chọn.
  },
  langText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textSub,
  },
  langTextActive: { color: '#fff' },
  bell: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 10,
  },
});
