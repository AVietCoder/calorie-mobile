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
            android_ripple={{ color: 'rgba(88,166,119,0.2)', borderless: true }}
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
    gap: 2,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    padding: 3,
  },
  langOpt: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.full,
    minWidth: 36,
    alignItems: 'center',
  },
  langOptActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
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
