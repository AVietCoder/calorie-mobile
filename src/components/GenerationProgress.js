import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme/colors';

/**
 * GenerationProgress — thanh tiến trình cho các tác vụ sinh thực đơn.
 *
 * Dùng chung cho cả ba luồng: lịch ăn cá nhân (/coach-dynamic), Kitchen gia
 * đình và tổ chức (/family-menu generate_plan).
 *
 * NGUYÊN TẮC: thanh này KHÔNG bịa tiến độ để che backend chậm.
 *
 *  • Backend không phát tiến độ thật, nên phần trăm ở đây là ƯỚC LƯỢNG theo
 *    thời gian đã trôi — và nó được nói rõ bằng cách KHÔNG BAO GIỜ tự chạy tới
 *    100%. Chỉ khi `done` bật (server đã trả kết quả) thanh mới nhảy lên 100%.
 *  • Đường cong bão hoà mũ: nhanh lúc đầu, chậm dần, tiệm cận CAP (96%) rồi bò
 *    rất chậm. Người dùng thấy chuyển động ngay nên biết máy đang chạy, nhưng
 *    không bị lừa rằng "sắp xong" khi backend còn đang làm.
 *
 * Chạy bằng Animated + useNativeDriver cho phần biến đổi, và một timer nhẹ
 * 250ms chỉ để cập nhật con số phần trăm — không dùng setState 60fps.
 *
 * @param {boolean} running  đang chạy
 * @param {boolean} done     server đã trả kết quả → chạy nốt lên 100%
 * @param {string}  [title]  tiêu đề thay thế
 * @param {number}  [expectedMs] thời gian kỳ vọng, dùng để định hình đường cong
 */

/** Các bước hiển thị, kèm mốc phần trăm bắt đầu. */
const STEPS = [
  { at: 0, icon: 'search', label: 'Đang phân tích thông tin' },
  { at: 25, icon: 'restaurant', label: 'Đang xây dựng thực đơn' },
  { at: 62, icon: 'nutrition', label: 'Đang kiểm tra dinh dưỡng' },
  { at: 86, icon: 'checkmark-done', label: 'Đang hoàn thiện' },
];

/* Mốc đổi lời trấn an. Người dùng chờ quá ~10s mà chữ không đổi sẽ tưởng treo. */
const REASSURE = [
  { after: 10_000, text: 'Vẫn đang xử lý — thực đơn 7 ngày cần một chút thời gian.' },
  { after: 30_000, text: 'Sắp xong rồi, hệ thống đang cân đối dinh dưỡng cả tuần…' },
];
const SLOW_AFTER_MS = 60_000;

/** Trần của phần ước lượng. Không bao giờ chạm 100% khi chưa có kết quả thật. */
const CAP = 96;

export default function GenerationProgress({ running, done, title, expectedMs = 12_000 }) {
  const [pct, setPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const width = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(null);

  useEffect(() => {
    if (!running) {
      startedAt.current = null;
      setPct(0); setElapsed(0);
      width.setValue(0);
      return undefined;
    }
    if (startedAt.current == null) startedAt.current = Date.now();

    const id = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      /*
       * Bão hoà mũ: p = CAP × (1 − e^(−t/τ)).
       * τ = expectedMs/2 nên tới mốc kỳ vọng đã đi được ~86% quãng đường, sau
       * đó mỗi giây thêm được ít dần — đúng cảm giác "nhanh đầu, chậm cuối" mà
       * không cần bảng mốc cứng. Cộng thêm một nhịp bò rất chậm sau đó để
       * thanh không đứng chết cứng ở 96 khi backend lâu bất thường.
       */
      const tau = Math.max(1, expectedMs / 2);
      const base = CAP * (1 - Math.exp(-ms / tau));
      const creep = Math.min(2, (ms / 60_000) * 2);   // tối đa +2% sau 60s
      setPct(Math.min(CAP + 2, base + creep));
    }, 250);
    return () => clearInterval(id);
  }, [running, expectedMs, width]);

  /* done = server đã trả kết quả THẬT → mới cho phép chạy nốt lên 100%. */
  const target = done ? 100 : pct;
  useEffect(() => {
    Animated.timing(width, {
      toValue: target,
      duration: done ? 320 : 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,   // animate width -> không chạy được trên native driver
    }).start();
  }, [target, done, width]);

  if (!running && !done) return null;

  const shown = Math.round(target);
  const step = [...STEPS].reverse().find((s) => shown >= s.at) || STEPS[0];
  const reassure = [...REASSURE].reverse().find((r) => elapsed >= r.after);
  const slow = elapsed >= SLOW_AFTER_MS;

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={step.label}>
      <View style={styles.head}>
        <Ionicons name={done ? 'checkmark-circle' : step.icon} size={17} color={colors.primary} />
        <Text style={styles.title} numberOfLines={1}>
          {done ? 'Đã xong!' : (title || step.label)}
        </Text>
        <Text style={styles.pct}>{shown}%</Text>
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>

      {/* Danh sách bước — bước đã qua tick xanh, bước đang chạy đậm. */}
      <View style={styles.steps}>
        {STEPS.map((s) => {
          const passed = done || shown > s.at + 4;
          const active = !done && step.at === s.at;
          return (
            <View key={s.at} style={styles.stepRow}>
              <Ionicons
                name={passed ? 'checkmark-circle' : active ? 'ellipse' : 'ellipse-outline'}
                size={12}
                color={passed ? colors.primary : active ? colors.primary : colors.borderStrong}
              />
              <Text style={[styles.stepText, (passed || active) && styles.stepTextOn]}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      {!done && slow && (
        <View style={styles.slow}>
          <Ionicons name="time-outline" size={13} color={colors.warning} />
          <Text style={styles.slowText}>
            Thực đơn đang được xử lý lâu hơn bình thường, bạn chờ thêm chút nhé…
          </Text>
        </View>
      )}
      {!done && !slow && !!reassure && <Text style={styles.note}>{reassure.text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.textMain },
  pct: { fontSize: font.size.md, fontWeight: font.weight.heavy, color: colors.primary },

  track: { height: 8, borderRadius: radius.full, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },

  steps: { gap: 5 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepText: { fontSize: font.size.sm, color: colors.textMuted },
  stepTextOn: { color: colors.textSub, fontWeight: font.weight.semibold },

  note: { fontSize: font.size.xs, color: colors.textSub, lineHeight: font.size.xs * 1.5 },
  slow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.warningSoft,
  },
  slowText: { flex: 1, fontSize: font.size.xs, color: '#8a5a12', lineHeight: font.size.xs * 1.5 },
});
