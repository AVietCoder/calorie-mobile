import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow, font } from '../theme/colors';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  const show = useCallback((message, type = 'info') => {
    setToast({ message, type });
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.sequence([
        Animated.delay(2200),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 240, useNativeDriver: true }),
        ]),
      ]).start(() => {
        setToast(null);
        translateY.setValue(-16);
      });
    });
  }, [opacity, translateY]);

  const color = {
    success: colors.success,
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
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
        >
          <View style={[styles.iconBubble, { backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={styles.txt} numberOfLines={3}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.md,
  },
  iconBubble: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  txt: {
    flex: 1,
    color: colors.textMain,
    fontSize: font.size.md,
    fontWeight: '600',
    lineHeight: font.size.md * 1.4,
  },
});
