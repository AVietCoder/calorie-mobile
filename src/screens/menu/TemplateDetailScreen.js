import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

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
import GenerationProgress from '../../components/GenerationProgress';
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
  /* Nền hero: ảnh admin tải lên trước, không có thì logo đơn vị. */
  const heroBg = tpl.image_url || logo;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/*
          Hero: ẢNH phủ kín nền, mọi nội dung nằm đè lên.

          Không còn tấm nền trắng bọc logo. `ImageBackground` + resizeMode
          "cover" phủ từ mép này sang mép kia và giữ nguyên tỉ lệ (cover cắt
          phần thừa chứ không kéo méo). Gradient tối phủ lên trên để chữ trắng
          luôn đọc được dù ảnh sáng hay tối.

          `defaultSource` là gradient danh mục nằm dưới cùng: nguồn chưa có
          logo, hoặc ảnh lỗi mạng, thì hero vẫn ra một khối màu tử tế thay vì ô
          đen trống.
        */}
        <View style={styles.heroWrap}>
          <LinearGradient colors={[cat.from, cat.to]} style={StyleSheet.absoluteFill} />
          <ImageBackground
            source={heroBg ? { uri: heroBg } : undefined}
            resizeMode="cover"
            style={styles.hero}
            imageStyle={styles.heroImg}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.72)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.heroContent}>
              {/* hàng trên: quay lại + danh mục + logo + hệ thống */}
              <View style={styles.heroTop}>
                <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
                  <Ionicons name="arrow-back" size={19} color="#fff" />
                </Pressable>
                <View style={styles.heroChip}>
                  <Ionicons name={cat.icon} size={12} color="#fff" />
                  <Text style={styles.heroChipText}>{cat.label}</Text>
                </View>
                {!!logo && (
                  <Image source={{ uri: logo }} style={styles.heroLogo} resizeMode="contain" />
                )}
                {!!tpl.is_system && (
                  <View style={styles.heroChip}>
                    <Ionicons name="shield-checkmark" size={12} color="#fff" />
                    <Text style={styles.heroChipText}>{t('ml.system', 'Hệ thống')}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.heroTitle}>{tpl.title}</Text>
              {!!tpl.description && <Text style={styles.heroDesc}>{tpl.description}</Text>}

              {/* hàng dưới: thống kê bên trái, hành động bên phải.
                  flexWrap để máy hẹp đẩy nút xuống dòng thay vì tràn ngang. */}
              <View style={styles.heroBottom}>
                <View style={styles.heroStats}>
                  <Stat value={days.length} label={t('ml.days', 'ngày')} />
                  <Stat value={dishCount} label={t('ml.dishes', 'món')} />
                  {kcal != null && <Stat value={vn(kcal)} label={t('ml.kcal_day', 'kcal/ngày')} />}
                </View>

                <View style={styles.heroActions}>
                  <Pressable
                    onPress={() => navigation.navigate('ShoppingList', { templateId: id, title: tpl.title })}
                    style={({ pressed }) => [styles.btnLight, pressed && { opacity: 0.9 }]}
                  >
                    <Ionicons name="cart-outline" size={15} color={colors.primaryDark} />
                    <Text style={styles.btnLightText}>{t('ml.shopping_short', 'Đi chợ')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={apply}
                    disabled={applying}
                    style={({ pressed }) => [styles.btnPrimary, (pressed || applying) && { opacity: 0.9 }]}
                  >
                    {applying
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Ionicons name="sparkles" size={15} color="#fff" />}
                    <Text style={styles.btnPrimaryText}>{t('ml.generate', 'Dùng thực đơn này')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Áp dụng thực đơn = dựng cả cây kế hoạch tuần trong DB. Nhanh (đo ~3s)
            nhưng vẫn phải cho thấy hệ thống đang chạy, nhất là khi mạng yếu. */}
        {applying && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <GenerationProgress
              running={applying}
              done={false}
              expectedMs={6_000}
              title={t('ml.applying', 'Đang tạo kế hoạch cho gia đình…')}
            />
          </View>
        )}

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

  /* overflow:hidden để bo góc cắt được cả ảnh nền bên trong. */
  heroWrap: {
    margin: spacing.lg, borderRadius: radius.xl, overflow: 'hidden',
    backgroundColor: colors.primaryDark, ...shadow.md,
  },
  hero: { minHeight: 260, justifyContent: 'flex-end' },
  heroImg: { borderRadius: radius.xl },
  heroContent: { padding: spacing.xl, gap: spacing.md },

  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
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
  /* Logo NÉT ở hàng huy hiệu: nền hero là ảnh đã phủ tối nên vẫn cần một bản
     rõ để đọc ra đơn vị phát hành. Nền trắng mờ nhẹ vì phần lớn logo là chữ
     sẫm — thả thẳng lên ảnh tối là mất hút. */
  heroLogo: {
    width: 74, height: 26, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  heroTitle: {
    fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: '#fff',
    lineHeight: font.size.xxl * 1.25,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8,
  },
  heroDesc: {
    fontSize: font.size.sm, color: 'rgba(255,255,255,0.9)', lineHeight: font.size.sm * 1.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },

  /* Thống kê trái · hành động phải. flexWrap + gap dọc để máy hẹp đẩy nút
     xuống dòng riêng thay vì bóp nhỏ hoặc tràn ra ngoài. */
  heroBottom: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs,
  },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: {
    fontSize: font.size.xl, fontWeight: font.weight.heavy, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  statLabel: { fontSize: font.size.xs, color: 'rgba(255,255,255,0.9)' },

  heroActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  btnLight: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 40, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  btnLightText: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.primaryDark },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, height: 40, borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  btnPrimaryText: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: '#fff' },

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
