import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, shadow, spacing } from '../theme/colors';

/* -------------------------------------------------------------------------- */
/* Card — premium surface với shadow tinh tế, radius lớn hơn                   */
/* -------------------------------------------------------------------------- */
export function Card({ style, children, elevated = true, padded = true }) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.cardPadded,
        elevated ? shadow.card : shadow.xs,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Button — chiều cao đồng nhất, ripple/scale feedback, states rõ ràng         */
/* -------------------------------------------------------------------------- */
export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  style,
  textStyle,
  disabled,
  fullWidth = false,
}) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  const sizeStyle =
    size === 'sm' ? styles.btnSm : size === 'lg' ? styles.btnLg : styles.btnMd;

  const textColor = isPrimary
    ? '#fff'
    : isDanger
    ? colors.danger
    : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
      style={({ pressed }) => [
        styles.btn,
        sizeStyle,
        isPrimary && styles.btnPrimary,
        isSecondary && styles.btnSecondary,
        isGhost && styles.btnGhost,
        isDanger && styles.btnDangerSoft,
        fullWidth && { alignSelf: 'stretch' },
        (loading || disabled) && styles.btnDisabled,
        pressed && !disabled && !loading && { transform: [{ scale: 0.985 }], opacity: 0.94 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.primary} />
      ) : (
        <>
          {icon}
          {title != null && (
            <Text
              style={[
                styles.btnText,
                size === 'sm' && { fontSize: font.size.md },
                size === 'lg' && { fontSize: font.size.lg },
                { color: textColor },
                textStyle,
              ]}
            >
              {title}
            </Text>
          )}
          {iconRight}
        </>
      )}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Field — TextInput với focus state, error state, hint đẹp                    */
/* -------------------------------------------------------------------------- */
export function Field({ label, error, hint, style, inputStyle, onFocus, onBlur, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 6, marginBottom: spacing.md }, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          inputStyle,
        ]}
        onFocus={(e) => { setFocused(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
        {...inputProps}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionTitle — headline + sub, spacing chuẩn                                */
/* -------------------------------------------------------------------------- */
export function SectionTitle({ children, sub, style }) {
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {sub && <Text style={styles.sectionSub}>{sub}</Text>}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Pill — filter chip                                                          */
/* -------------------------------------------------------------------------- */
export function Pill({ label, active, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(88,166,119,0.15)' }}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  /* ---- Card ---- */
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardPadded: { padding: spacing.lg },

  /* ---- Button ---- */
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
  },
  btnSm: { paddingVertical: 10, paddingHorizontal: 14, minHeight: 40 },
  btnMd: { paddingVertical: 13, paddingHorizontal: 18, minHeight: 48 },
  btnLg: { paddingVertical: 16, paddingHorizontal: 22, minHeight: 54 },
  btnPrimary: {
    backgroundColor: colors.primary,
    ...shadow.sm,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.22,
  },
  btnSecondary: { backgroundColor: colors.primarySoft },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDangerSoft: { backgroundColor: colors.dangerSoft },
  btnDisabled: { opacity: 0.55 },
  btnText: {
    fontSize: font.size.lg,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  /* ---- Field ---- */
  label: {
    fontSize: font.size.md,
    fontWeight: '600',
    color: colors.textMain,
    letterSpacing: 0.1,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: font.size.lg,
    color: colors.textMain,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: '#fff',
    ...shadow.xs,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: '#FFF9F9',
  },
  errorText: { color: colors.danger, fontSize: font.size.sm, fontWeight: '500' },
  hintText: { color: colors.textSub, fontSize: font.size.sm },

  /* ---- Section ---- */
  sectionTitle: {
    fontSize: font.size.xxl,
    fontWeight: '700',
    color: colors.textMain,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: font.size.md,
    color: colors.textSub,
    marginTop: 4,
    lineHeight: font.size.md * font.lh.snug,
  },

  /* ---- Pill ---- */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadow.xs,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.2,
  },
  pillText: {
    fontWeight: '600',
    color: colors.textSub,
    fontSize: font.size.sm,
    letterSpacing: 0.2,
  },
  pillTextActive: { color: '#fff' },
});
