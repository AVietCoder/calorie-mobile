// src/components/HeaderWidgets.js
// Nút đổi ngôn ngữ (VI/EN) + chuông nhắc nhở dùng chung trên header các màn hình.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
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
          <Pressable key={l} onPress={() => setLang(l)} style={[styles.langOpt, active && styles.langOptActive]}>
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
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.bell}>
        <Ionicons name="notifications-outline" size={size} color={color} />
        {reminders.length > 0 && <View style={styles.dot} />}
      </Pressable>
      <ReminderManager visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  langWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.primarySoft, borderRadius: 999, padding: 3,
  },
  langOpt: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  langOptActive: { backgroundColor: colors.primary },
  langText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: colors.textSub },
  langTextActive: { color: '#fff' },
  bell: { position: 'relative', padding: 2 },
  dot: {
    position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#B8975A', borderWidth: 1.5, borderColor: '#fff',
  },
});
