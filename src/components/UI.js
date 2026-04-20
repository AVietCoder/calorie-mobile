import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, shadow, spacing } from '../theme/colors';

export function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, loading, variant = 'primary', icon, style, disabled }) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        isGhost && styles.btnGhost,
        (loading || disabled) && { opacity: 0.6 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[
            styles.btnText,
            isPrimary && { color: '#fff' },
            (variant === 'secondary' || isGhost) && { color: colors.primary },
          ]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, ...inputProps }) {
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

export function SectionTitle({ children, sub }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {sub && <Text style={styles.sectionSub}>{sub}</Text>}
    </View>
  );
}

export function Pill({ label, active, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      {icon}
      <Text style={[styles.pillText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.lg, ...shadow.card,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius.lg,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: colors.primarySoft },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnText: { fontSize: font.size.lg, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: '#444' },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eee',
    borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14,
    fontSize: 16, color: colors.textMain,
  },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: colors.textMain },
  sectionSub: { fontSize: 14, color: colors.textSub, marginTop: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#fff',
  },
  pillText: { fontWeight: '600', color: colors.textSub, fontSize: 13 },
});
