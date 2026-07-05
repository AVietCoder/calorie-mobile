// src/components/AssistantOverlay.js
// Nút mic nổi (FAB) + bảng trạng thái của Trợ lý giọng nói. Mount ở App.js nên hiện trên
// MỌI tab. Chỉ hiện khi đã đăng nhập.
//   • Chạm: đang nói → dừng; đang đọc → "chen ngang" (barge-in) nói tiếp; rảnh → nói.
//   • Giữ (long-press): bật/tắt chế độ rảnh tay ("Hey Calorie") nếu đã cấu hình Picovoice.
//   • KÉO (Issue 1): FAB kéo-thả tự do như AssistiveTouch, thả ra tự HÍT về cạnh gần nhất,
//     bị giới hạn để KHÔNG che thanh nhập/nút Gửi/thanh điều hướng, và NHỚ vị trí (AsyncStorage).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat,
  cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAssistant } from '../context/AssistantContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { colors, radius, shadow } from '../theme/colors';

const FAB = 58;              // đường kính nút
const MARGIN = 14;          // cách mép màn hình
const POS_KEY = 'assistant_fab_pos_v1';
const SPRING = { damping: 18, stiffness: 200, mass: 0.6 };

export default function AssistantOverlay() {
  const { token } = useAuth();
  const { t } = useI18n();
  const {
    status, transcript, reply, startTurn, cancel,
    wakeEnabled, wakeAvailable, toggleWake,
  } = useAssistant();
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');

  const active = status !== 'idle';
  const [hint, setHint] = useState('');       // thông báo thoáng qua khi bật/tắt rảnh tay
  const hintTimer = useRef(null);

  // ── Vùng cho phép kéo (chừa header trên + thanh nhập/nav dưới) ──
  const minX = MARGIN;
  const maxX = win.width - FAB - MARGIN;
  const minY = insets.top + 56 + 8;                       // dưới header
  const maxY = win.height - FAB - insets.bottom - 96;     // trên thanh nhập

  // Vị trí (shared values) + trạng thái kéo để phân biệt tap/drag.
  const tx = useSharedValue(maxX);                        // mặc định: nép phải
  const ty = useSharedValue(Math.max(minY, maxY - 40));   // trên thanh nhập một chút
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const pulse = useSharedValue(1);
  const [loadedPos, setLoadedPos] = useState(false);

  const persist = (x, y) => { AsyncStorage.setItem(POS_KEY, JSON.stringify({ x, y })).catch(() => {}); };

  // Nạp vị trí đã lưu (clamp lại theo màn hình hiện tại).
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(POS_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (typeof p?.x === 'number' && typeof p?.y === 'number') {
            tx.value = Math.min(Math.max(p.x, minX), maxX);
            ty.value = Math.min(Math.max(p.y, minY), maxY);
          }
        }
      } catch {}
      setLoadedPos(true);
    })();
  }, []); // eslint-disable-line

  // Mic "thở" khi đang nghe.
  useEffect(() => {
    if (status === 'listening') {
      pulse.value = withRepeat(withTiming(1.16, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 220 });
    }
  }, [status]); // eslint-disable-line

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);

  // Style FAB (transform kéo + scale "thở"). PHẢI khai báo TRƯỚC mọi early-return
  // để số lượng hook không đổi giữa các lần render (Rules of Hooks).
  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: pulse.value },
    ],
  }));

  if (!token) return null;

  const flashHint = (msg) => {
    setHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), 2600);
  };

  const onPress = () => {
    // Đang nghe / xử lý → hủy. Rảnh hoặc đang đọc → nói (đang đọc = chen ngang, GIỮ ngữ cảnh).
    if (status === 'listening' || status === 'thinking') cancel();
    else startTurn();
  };

  const onLongPress = async () => {
    const res = await toggleWake();
    if (!res?.ok) { flashHint(t('assistant.wake_unavailable', 'Chế độ rảnh tay cần cấu hình Picovoice (xem README).')); return; }
    flashHint(res.enabled
      ? t('assistant.wake_on', 'Đã bật chế độ rảnh tay. Hãy nói "Hey Calorie".')
      : t('assistant.wake_off', 'Đã tắt chế độ rảnh tay.'));
  };

  // ── Cử chỉ KÉO: mượt (chạy trên UI thread), thả ra HÍT về cạnh gần nhất ──
  const pan = Gesture.Pan()
    .minDistance(6)                 // < 6px coi là "chạm/giữ" → nhường cho Pressable (tap & long-press)
    .onStart(() => { startX.value = tx.value; startY.value = ty.value; dragging.value = true; })
    .onUpdate((e) => {
      tx.value = Math.min(Math.max(startX.value + e.translationX, minX), maxX);
      ty.value = Math.min(Math.max(startY.value + e.translationY, minY), maxY);
    })
    .onEnd(() => {
      // Hít về mép trái/phải gần hơn theo tâm nút.
      const snapRight = (tx.value + FAB / 2) > win.width / 2;
      const targetX = snapRight ? maxX : minX;
      tx.value = withSpring(targetX, SPRING);
      runOnJS(persist)(targetX, ty.value);
    })
    .onFinalize(() => { dragging.value = false; });

  const armed = wakeEnabled && wakeAvailable;

  const statusLabel = status === 'listening'
    ? t('assistant.listening', 'Đang nghe…')
    : status === 'thinking'
      ? t('assistant.thinking', 'Đang xử lý…')
      : t('assistant.speaking', 'Đang trả lời…');

  // Bảng trạng thái/gợi ý neo ở ĐÁY (trên thanh nhập) — tách khỏi FAB nên không bao giờ
  // che nút Gửi khi người dùng đã kéo FAB đi nơi khác.
  const panelBottom = insets.bottom + 96;

  return (
    <>
      {(active || !!hint || (armed && !active)) && (
        <View style={[styles.panelWrap, { bottom: panelBottom }]} pointerEvents="box-none">
          {!!hint && (
            <View style={styles.hint}><Text style={styles.hintText}>{hint}</Text></View>
          )}

          {active && (
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={[styles.liveDot, status !== 'listening' && { backgroundColor: colors.warning }]} />
                <Text style={styles.panelTitle}>{statusLabel}</Text>
                <Pressable onPress={cancel} hitSlop={10}>
                  <Ionicons name="close" size={18} color={colors.textSub} />
                </Pressable>
              </View>

              {status === 'listening' && (
                <ScrollView style={styles.transcriptScroll} showsVerticalScrollIndicator persistentScrollbar
                  nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  <Text style={styles.transcript}>
                    {transcript || t('assistant.say_something', 'Hãy nói điều bạn muốn…')}
                  </Text>
                </ScrollView>
              )}
              {status === 'thinking' && (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.thinkingText}>{t('assistant.thinking', 'Đang xử lý…')}</Text>
                </View>
              )}
              {/* Reply DÀI → cho cuộn (thanh cuộn LUÔN hiện nhờ persistentScrollbar) để đọc hết. */}
              {status === 'speaking' && !!reply && (
                <ScrollView style={styles.replyScroll} showsVerticalScrollIndicator persistentScrollbar
                  nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  <Text style={styles.reply}>{reply}</Text>
                </ScrollView>
              )}
            </View>
          )}

          {!active && armed && (
            <View style={styles.armedChip}>
              <MaterialCommunityIcons name="ear-hearing" size={13} color={colors.primaryDark} />
              <Text style={styles.armedText}>{t('assistant.wake_armed', 'Đang nghe "Hey Calorie"')}</Text>
            </View>
          )}
        </View>
      )}

      {/* FAB kéo-thả — nằm trên cùng, absolute, điều khiển bằng transform (UI thread). */}
      {loadedPos && (
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.fabWrap, fabStyle]}>
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              delayLongPress={450}
              style={[styles.fab, active && styles.fabActive]}
              android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
            >
              <MaterialCommunityIcons
                name={active ? 'microphone' : 'microphone-outline'}
                size={26}
                color="#fff"
              />
              {armed && !active && <View style={styles.armDot} />}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  panelWrap: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 80,
  },
  // FAB: absolute top-left; vị trí do transform translateX/Y quyết định.
  fabWrap: {
    position: 'absolute',
    top: 0, left: 0,
    width: FAB, height: FAB,
    zIndex: 95,
  },
  fab: {
    width: FAB, height: FAB, borderRadius: FAB / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  fabActive: { backgroundColor: colors.danger },
  armDot: {
    position: 'absolute', top: 6, right: 6,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.warning, borderWidth: 2, borderColor: '#fff',
  },

  armedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end',
    backgroundColor: colors.primarySoft, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.primary,
  },
  armedText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },

  hint: {
    alignSelf: 'stretch',
    backgroundColor: colors.textMain,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10,
    ...shadow.md,
  },
  hintText: { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },

  panel: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: 14,
    ...shadow.md,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  panelTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.textMain },
  transcriptScroll: { maxHeight: 120, marginTop: 8 },
  transcript: { fontSize: 15, color: colors.textMain, lineHeight: 21 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  thinkingText: { fontSize: 13, color: colors.textSub, fontWeight: '600' },
  replyScroll: { maxHeight: 260, marginTop: 8 },
  reply: { fontSize: 14, color: colors.textMain, lineHeight: 21 },
});
