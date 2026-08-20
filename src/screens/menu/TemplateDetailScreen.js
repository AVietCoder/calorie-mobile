import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import { Button } from '../../components/UI';
import { FamilyMenuAPI } from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, font, radius, shadow, spacing } from '../../theme/colors';
import { useI18n } from '../../i18n';
import { getCategory } from '../../menu/categories';
import { sourceLogo } from '../../menu/sourceLogos';
import { dayLabel, todayDayIndex } from '../../menu/labels';
import {
  MEAL_ICON, mealsOf, kcalOf, stripAmounts, avgKcal, countDishes,
} from '../../menu/templateUtils';
import TemplateDayModal from '../../components/menu/TemplateDayModal';
import { confirmAction } from '../../utils/confirm';

const vn = (v) => Number(v).toLocaleString('vi-VN');

/** jsonb hỏng không được làm sập cả màn — nó chỉ là siêu dữ liệu. */
function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

/** Thẻ tóm tắt một ngày. Bấm vào mở modal chi tiết dinh dưỡng. */
function DayCard({ day, isToday, onPress, t }) {
  const meals = mealsOf(day);
  const kcal = kcalOf(meals.flatMap((m) => m.menu_template_dishes || []));

  return (
    <Pressable
      onPress={() => onPress(day)}
      style={({ pressed }) => [styles.day, isToday && styles.dayToday, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.dayHead}>
        <Text style={[styles.dayName, isToday && { color: colors.primaryDark }]}>
          {dayLabel(day.day_index)}
        </Text>
        {isToday && (
          <View style={styles.todayChip}>
            <Text style={styles.todayChipText}>{t('ml.today', 'Hôm nay')}</Text>
          </View>
        )}
        {kcal > 0 && <Text style={styles.dayKcal}>{vn(Math.round(kcal))} kcal</Text>}
      </View>

      {meals.map((m) => {
        const dishes = m.menu_template_dishes || [];
        if (!dishes.length) return null;
        return (
          <View key={m.id} style={styles.dayMeal}>
            <Ionicons name={MEAL_ICON[m.meal_type] || 'restaurant'} size={12} color={colors.textMuted} />
            {/* Bỏ định lượng trên thẻ: thẻ chỉ để liếc xem hôm đó ăn gì, con số
                đẩy tên món xuống dòng. Định lượng đủ nằm trong modal. */}
            <Text style={styles.dayDish} numberOfLines={2}>
              {dishes.map((d) => stripAmounts(d.name)).join(' · ')}
            </Text>
          </View>
        );
      })}

      <View style={styles.dayCta}>
        <Text style={styles.dayCtaText}>{t('ml.day_detail', 'Xem chi tiết dinh dưỡng')}</Text>
        <Ionicons name="chevron-forward" size={13} color={colors.primary} />
      </View>
    </Pressable>
  );
}

export default function TemplateDetailScreen({ route, navigation }) {
  const { id, householdId } = route.params || {};
  const { t } = useI18n();
  const toast = useToast();

  const [tpl, setTpl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [openDay, setOpenDay] = useState(null);

  /* `toast` CỐ Ý không nằm trong mảng phụ thuộc của load.
     ToastContext truyền value={{ show }} — object MỚI mỗi lần provider render,
     nên thêm nó vào deps sẽ biến useFocusEffect thành vòng lặp: lỗi → hiện
     toast → provider render → load đổi định danh → gọi lại → lỗi… Bắt qua
     closure là an toàn vì `show` đã được useCallback giữ nguyên định danh. */
  const load = useCallback(async () => {
    try {
      setTpl(await FamilyMenuAPI.template(id));
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = useMemo(
    () => [...(tpl?.days || [])].sort((a, b) => a.day_index - b.day_index),
    [tpl]
  );
  const kcal = useMemo(() => avgKcal(days), [days]);
  const dishCount = useMemo(() => countDishes(days), [days]);
  const today = todayDayIndex();

  /* Xuất xứ số liệu; jsonb nên có thể về dạng chuỗi nếu tầng nào đó serialize. */
  const sm = typeof tpl?.source_meta === 'string' ? safeJson(tpl.source_meta) : tpl?.source_meta;

  async function apply() {
    /* Áp dụng sẽ THAY kế hoạch tuần đang chạy. Trên web người dùng thấy cả
       trang trước khi bấm; trên điện thoại nút nằm ngay tầm ngón cái nên phải
       hỏi lại, chạm nhầm là mất kế hoạch đang dùng. */
    const okToGo = await confirmAction({
      title: t('ml.apply_title', 'Dùng thực đơn này?'),
      message: t('ml.apply_msg', 'Kế hoạch ăn tuần hiện tại của gia đình sẽ được thay bằng thực đơn này.'),
      confirmText: t('ml.apply_yes', 'Dùng thực đơn'),
    });
    if (!okToGo) return;

    setApplying(true);
    try {
      await FamilyMenuAPI.generatePlan(householdId, id);
      toast.show(t('ml.applied', 'Đã tạo kế hoạch từ thực đơn này.'), 'success');
      navigation.navigate('MenuPlan', { householdId });
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }
  if (!tpl) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.empty}>{t('ml.not_found', 'Không tìm thấy thực đơn này.')}</Text>
      </SafeAreaView>
    );
  }

  const cat = getCategory(tpl.category);
  const logo = sourceLogo(tpl.source_name);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero: gradient danh mục, huy hiệu + tiêu đề + thống kê đè lên. */}
        <LinearGradient colors={[cat.from, cat.to]} style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
              <Ionicons name="arrow-back" size={19} color="#fff" />
            </Pressable>
            <View style={styles.heroChip}>
              <Ionicons name={cat.icon} size={12} color="#fff" />
              <Text style={styles.heroChipText}>{cat.label}</Text>
            </View>
            {!!logo && (
              <View style={styles.heroLogo}>
                <Image source={{ uri: logo }} style={styles.heroLogoImg} resizeMode="contain" />
              </View>
            )}
          </View>

          <Text style={styles.heroTitle}>{tpl.title}</Text>
          {!!tpl.description && <Text style={styles.heroDesc}>{tpl.description}</Text>}

          <View style={styles.heroStats}>
            <Stat value={days.length} label={t('ml.days', 'ngày')} />
            <Stat value={dishCount} label={t('ml.dishes', 'món')} />
            {kcal != null && <Stat value={vn(kcal)} label={t('ml.kcal_day', 'kcal/ngày')} />}
          </View>
        </LinearGradient>

        <View style={styles.actions}>
          <Button
            title={t('ml.generate', 'Dùng thực đơn này')}
            onPress={apply}
            loading={applying}
            fullWidth
            icon={<Ionicons name="sparkles" size={16} color="#fff" style={{ marginRight: 6 }} />}
          />
          <Button
            title={t('ml.shopping', 'Xem danh sách đi chợ')}
            variant="secondary"
            onPress={() => navigation.navigate('ShoppingList', { templateId: id, title: tpl.title })}
            fullWidth
            icon={<Ionicons name="cart-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />}
          />
        </View>

        <Text style={styles.sectionTitle}>{t('ml.week', 'Thực đơn 7 ngày')}</Text>
        {days.map((d) => (
          <DayCard
            key={d.id}
            day={d}
            isToday={d.day_index === today}
            onPress={setOpenDay}
            t={t}
          />
        ))}

        {/* Xuất xứ — ứng dụng sức khoẻ thì người dùng phải tra được nguồn gốc. */}
        {(sm || tpl.source_name) && (
          <View style={styles.prov}>
            <Text style={styles.provTitle}>{t('ml.provenance', 'Nguồn dữ liệu')}</Text>
            {!!tpl.source_name && <ProvRow label={t('ml.prov_publisher', 'Đơn vị')} value={tpl.source_name} />}
            {!!sm?.publishedAt && <ProvRow label={t('ml.prov_published', 'Ngày đăng')} value={sm.publishedAt} />}
            {!!sm?.reviewer && <ProvRow label={t('ml.prov_reviewer', 'Tham vấn y khoa')} value={sm.reviewer} />}
            {!!sm?.audience && <ProvRow label={t('ml.prov_audience', 'Đối tượng')} value={sm.audience} />}
            {!!sm?.calorieTarget && <ProvRow label={t('ml.prov_target', 'Mẫu khẩu phần')} value={sm.calorieTarget} />}
            {!!sm?.nutritionSource && <ProvRow label={t('ml.prov_nutrition', 'Dinh dưỡng')} value={sm.nutritionSource} />}
          </View>
        )}

        <Text style={styles.disclaimer}>
          {t('ml.day_modal_note', 'Số liệu dinh dưỡng là ước tính cho một suất, lấy từ tài liệu của đơn vị phát hành. Không thay thế chỉ định của bác sĩ.')}
        </Text>
      </ScrollView>

      <TemplateDayModal day={openDay} onClose={() => setOpenDay(null)} t={t} />
    </SafeAreaView>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProvRow({ label, value }) {
  return (
    <View style={styles.provRow}>
      <Text style={styles.provLabel}>{label}</Text>
      <Text style={styles.provValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.huge },
  empty: { color: colors.textSub, fontSize: font.size.md },

  hero: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: {
    width: 34, height: 34, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)',
  },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, height: 28, borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroChipText: { fontSize: font.size.xs, fontWeight: font.weight.bold, color: '#fff' },
  heroLogo: {
    width: 82, height: 28, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.94)', padding: 4,
  },
  heroLogoImg: { width: '100%', height: '100%' },

  heroTitle: {
    fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: '#fff',
    lineHeight: font.size.xxl * 1.25, marginTop: spacing.sm,
  },
  heroDesc: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.9)', lineHeight: font.size.sm * 1.5 },
  heroStats: { flexDirection: 'row', gap: spacing.xxl, marginTop: spacing.sm },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontSize: font.size.xl, fontWeight: font.weight.heavy, color: '#fff' },
  statLabel: { fontSize: font.size.xs, color: 'rgba(255,255,255,0.9)' },

  actions: { padding: spacing.lg, gap: spacing.sm },

  sectionTitle: {
    fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.textMain,
    paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md,
  },

  day: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    padding: spacing.lg, borderRadius: radius.lg, gap: 7,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    ...shadow.xs,
  },
  dayToday: { borderColor: colors.primary, borderWidth: 1.5 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayName: { fontSize: font.size.md, fontWeight: font.weight.heavy, color: colors.textMain },
  todayChip: {
    paddingHorizontal: 8, height: 19, borderRadius: radius.full,
    justifyContent: 'center', backgroundColor: colors.primarySoft,
  },
  todayChipText: { fontSize: 10, fontWeight: font.weight.bold, color: colors.primaryDark },
  dayKcal: { marginLeft: 'auto', fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.primary },

  dayMeal: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  dayDish: { flex: 1, fontSize: font.size.sm, color: colors.textSub, lineHeight: font.size.sm * 1.45 },

  dayCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
  },
  dayCtaText: { fontSize: font.size.xs, fontWeight: font.weight.semibold, color: colors.primary },

  prov: {
    margin: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, gap: 7,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  provTitle: { fontSize: font.size.md, fontWeight: font.weight.heavy, color: colors.textMain, marginBottom: 2 },
  provRow: { flexDirection: 'row', gap: spacing.md },
  provLabel: { width: 120, fontSize: font.size.sm, color: colors.textMuted },
  provValue: { flex: 1, fontSize: font.size.sm, color: colors.textSub },

  disclaimer: {
    paddingHorizontal: spacing.lg, fontSize: font.size.xs,
    color: colors.textMuted, lineHeight: font.size.xs * 1.6,
  },
});
