import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow } from '../theme/colors';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback((message, type = 'info') => {
    setToast({ message, type });
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity]);

  const color = {
    success: colors.primary,
    error: colors.danger,
    warning: colors.warning,
    info: colors.info,
  }[toast?.type] || colors.primary;

  const icon = {
    success: 'checkmark-circle',
    error: 'close-circle',
    warning: 'warning',
    info: 'information-circle',
  }[toast?.type] || 'information-circle';

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View style={[styles.wrap, { opacity, borderLeftColor: color }]}>
          <Ionicons name={icon} size={22} color={color} />
          <Text style={styles.txt}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 60, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderLeftWidth: 4, ...shadow.card,
  },
  txt: { flex: 1, color: colors.textMain, fontSize: 14, fontWeight: '500' },
});
