import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card } from '../../components/UI';
import { FamilyMenuAPI } from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, font, radius, shadow, spacing } from '../../theme/colors';
import { useI18n } from '../../i18n';
import { dayLabel, mealLabel, todayDayIndex, MEAL_ORDER } from '../../menu/labels';
import { MEAL_ICON } from '../../menu/templateUtils';

const vn = (v) => Number(v).toLocaleString('vi-VN');

/*
 * Cây KẾ HOẠCH khác cây THƯ VIỆN: plan_days → plan_meals → plan_dishes, chứ
 * không phải menu_template_*. Cùng hình dạng nhưng khác tên bảng, nên không
 * dùng lại được helper của thư viện — viết riêng ở đây thay vì nhồi thêm cờ
 * vào templateUtils.
 */
const planMealsOf = (day) =>
  [...(day?.plan_meals || [])].sort(
    (a, b) => (MEAL_ORDER[a.meal_type] || 99) - (MEAL_ORDER[b.meal_type] || 99)
  );

const dayKcal = (day) =>
  planMealsOf(day).reduce(
    (s, m) => s + (m.plan_dishes || []).reduce((n, d) => n + (Number(d.calories) || 0), 0),
    0
  );

export default function MenuPlanScreen({ route, navigation }) {
  const { householdId } = route.params || {};
  const { t } = useI18n();
  const toast = useToast();

  const [plan, setPlan] = useState(undefined); // undefined = chưa tải, null = chưa có
  const [refreshing, setRefreshing] = useState(false);

  /* `toast` CỐ Ý không nằm trong mảng phụ thuộc của load.
     ToastContext truyền value={{ show }} — object MỚI mỗi lần provider render,
     nên thêm nó vào deps sẽ biến useFocusEffect thành vòng lặp: lỗi → hiện
     toast → provider render → load đổi định danh → gọi lại → lỗi… Bắt qua
     closure là an toàn vì `show` đã được useCallback giữ nguyên định danh. */
  const load = useCallback(async () => {
    try {
      setPlan(await FamilyMenuAPI.plan(householdId));
    } catch (e) {
      toast.show(e.message, 'error');
      setPlan(null);
    } finally {
      setRefreshing(false);
    }
  }, [householdId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = useMemo(
    () => [...(plan?.plan_days || [])].sort((a, b) => a.day_index - b.day_index),
    [plan]
  );
  const today = todayDayIndex();

  if (plan === undefined) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="restaurant-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('mp.empty_title', 'Chưa có kế hoạch nào')}</Text>
          <Text style={styles.emptyBody}>
            {t('mp.empty_body', 'Chọn một thực đơn trong thư viện rồi bấm "Dùng thực đơn này" để tạo kế hoạch cho tuần.')}
          </Text>
          <Button
            title={t('mp.go_library', 'Mở thư viện thực đơn')}
            onPress={() => navigation.navigate('MenuLibrary')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
            <Ionicons name="arrow-back" size={19} color={colors.textMain} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('mp.title', 'Kế hoạch ăn tuần này')}</Text>
            {!!plan.week_start_date && (
              <Text style={styles.sub}>
                {t('mp.from', 'Từ')} {plan.week_start_date}
              </Text>
            )}
          </View>
        </View>

        <Button
          title={t('mp.shopping', 'Danh sách đi chợ')}
          variant="secondary"
          onPress={() => navigation.navigate('ShoppingList', { planId: plan.id, title: t('mp.title', 'Kế hoạch ăn tuần này') })}
          fullWidth
          icon={<Ionicons name="cart-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />}
          style={{ marginBottom: spacing.lg }}
        />

        {days.map((d) => {
          const kcal = dayKcal(d);
          const isToday = d.day_index === today;
          return (
            <Card key={d.id} style={[styles.day, isToday && styles.dayToday]}>
              <View style={styles.dayHead}>
                <Text style={[styles.dayName, isToday && { color: colors.primaryDark }]}>
                  {dayLabel(d.day_index)}
                </Text>
                {isToday && (
                  <View style={styles.todayChip}>
                    <Text style={styles.todayChipText}>{t('ml.today', 'Hôm nay')}</Text>
                  </View>
                )}
                {kcal > 0 && <Text style={styles.dayKcal}>{vn(Math.round(kcal))} kcal</Text>}
              </View>

              {planMealsOf(d).map((m) => {
                const dishes = m.plan_dishes || [];
                if (!dishes.length) return null;
                return (
                  <View key={m.id} style={styles.meal}>
                    <View style={styles.mealHead}>
                      <Ionicons name={MEAL_ICON[m.meal_type] || 'restaurant'} size={12} color={colors.textMuted} />
                      <Text style={styles.mealName}>{mealLabel(m.meal_type)}</Text>
                    </View>
                    {dishes.map((dish) => (
                      <View key={dish.id} style={styles.dish}>
                        <Text style={styles.dishName}>{dish.name}</Text>
                        {Number(dish.calories) > 0 && (
                          <Text style={styles.dishKcal}>{Math.round(dish.calories)} kcal</Text>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  back: {
    width: 34, height: 34, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  title: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.textMain },
  sub: { fontSize: font.size.sm, color: colors.textSub, marginTop: 2 },

  emptyTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.textMain, marginTop: spacing.md },
  emptyBody: { fontSize: font.size.sm, color: colors.textSub, textAlign: 'center', lineHeight: font.size.sm * 1.5 },

  day: { marginBottom: spacing.md, gap: spacing.md, ...shadow.xs },
  dayToday: { borderColor: colors.primary, borderWidth: 1.5 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayName: { fontSize: font.size.md, fontWeight: font.weight.heavy, color: colors.textMain },
  todayChip: {
    paddingHorizontal: 8, height: 19, borderRadius: radius.full,
    justifyContent: 'center', backgroundColor: colors.primarySoft,
  },
  todayChipText: { fontSize: 10, fontWeight: font.weight.bold, color: colors.primaryDark },
  dayKcal: { marginLeft: 'auto', fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.primary },

  meal: { gap: 5 },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealName: {
    fontSize: font.size.xs, fontWeight: font.weight.heavy, color: colors.textSub,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  dish: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 7, paddingHorizontal: spacing.md,
    borderRadius: radius.sm, backgroundColor: colors.surfaceAlt,
  },
  dishName: { flex: 1, fontSize: font.size.sm, color: colors.textMain },
  dishKcal: { fontSize: font.size.xs, color: colors.textSub, fontWeight: font.weight.semibold },
});
