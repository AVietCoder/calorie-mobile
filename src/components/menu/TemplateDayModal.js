import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, radius, spacing } from '../../theme/colors';
import { dayLabel, mealLabel } from '../../menu/labels';
import { MEAL_ICON, mealsOf, kcalOf, templateDayTotals } from '../../menu/templateUtils';
import { analyseIngredients } from '../../menu/ingredientAnalysis';

const vn = (v) => Number(v).toLocaleString('vi-VN');
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const hasNum = (i) => i.grams != null || String(i.price || '').trim();

/**
 * Nguyên liệu ĐÁNG hiển thị.
 *
 * Bộ nhập sinh một "nguyên liệu giả" trùng y hệt tên món cho những món không
 * khai định lượng ("Sữa đậu nành không đường" → nguyên liệu cùng tên, không số
 * nào). Hiện nó ra là lặp lại tên món kèm một dòng trống — nhiễu thuần tuý.
 */
function usefulIngredients(dish) {
  const list = dish.menu_template_dish_ingredients || [];
  return list.filter((i) => hasNum(i) || !same(i.name, dish.name));
}

/** Thanh tỉ lệ macro / nhóm nguyên liệu — dùng chung, chỉ khác bộ đoạn màu. */
function Bar({ segments }) {
  return (
    <View style={styles.track}>
      {segments
        .filter((s) => s.percent > 0)
        .map((s, i) => (
          <View key={i} style={{ width: `${s.percent}%`, backgroundColor: s.color, height: '100%' }} />
        ))}
    </View>
  );
}

export default function TemplateDayModal({ day, onClose, t }) {
  const open = !!day;

  const totals = useMemo(
    () => (day ? templateDayTotals(day) : { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 }),
    [day]
  );
  const meals = useMemo(() => (day ? mealsOf(day) : []), [day]);

  /* Phân tích nguyên liệu cả ngày. Macro trả lời "bao nhiêu đạm/béo/bột", còn
     cái này trả lời "ăn những NHÓM thực phẩm nào" — một ngày đủ đạm vẫn có thể
     không có lấy một cọng rau. */
  const analysis = useMemo(
    () => analyseIngredients(meals.flatMap((m) => (m.menu_template_dishes || []).flatMap(usefulIngredients))),
    [meals]
  );

  const { calories, protein, fat, carbs, fiber, sugar, sodium } = totals;
  /* Nhiều thực đơn nguồn chỉ liệt kê tên món. Khi đó "0 kcal" và một thanh xám
     trơn trông như hỏng — thà nói thẳng là chưa có số liệu. */
  const hasNutrition = calories > 0 || protein > 0 || fat > 0 || carbs > 0;

  const macroTotal = protein * 4 + fat * 9 + carbs * 4;
  const macroSegs = macroTotal > 0
    ? [
      { percent: (protein * 4 / macroTotal) * 100, color: '#5b9cf6' },
      { percent: (fat * 9 / macroTotal) * 100, color: '#f5a623' },
      { percent: (carbs * 4 / macroTotal) * 100, color: '#7dc976' },
    ]
    : [];

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.head}>
            <Text style={styles.headTitle}>{day ? dayLabel(day.day_index) : ''}</Text>
            {hasNutrition && (
              <Text style={styles.headKcal}>{vn(Math.round(calories))} kcal</Text>
            )}
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.textSub} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {hasNutrition ? (
              <View>
                <Bar segments={macroSegs} />
                <View style={styles.legend}>
                  <Legend color="#5b9cf6" label={t('mp.protein', 'Đạm')} value={`${Math.round(protein)}g`} />
                  <Legend color="#f5a623" label={t('mp.fat', 'Béo')} value={`${Math.round(fat)}g`} />
                  <Legend color="#7dc976" label={t('mp.carbs', 'Bột')} value={`${Math.round(carbs)}g`} />
                </View>
              </View>
            ) : (
              <View style={styles.note}>
                <Ionicons name="information-circle" size={16} color={colors.info} />
                <Text style={styles.noteText}>
                  {t('ml.day_no_nutrition', 'Thực đơn nguồn này chỉ liệt kê món, chưa kèm số liệu dinh dưỡng. Bạn vẫn xem được nguyên liệu của từng món bên dưới.')}
                </Text>
              </View>
            )}

            {(fiber > 0 || sugar > 0 || sodium > 0) && (
              <View style={styles.micros}>
                {fiber > 0 && <Micro value={Math.round(fiber)} unit="g" label={t('mp.fiber', 'Xơ')} />}
                {sugar > 0 && <Micro value={Math.round(sugar)} unit="g" label={t('mp.sugar', 'Đường')} />}
                {sodium > 0 && <Micro value={vn(Math.round(sodium))} unit="mg" label={t('mp.sodium', 'Natri')} />}
              </View>
            )}

            {/* Phân tích nguyên liệu — cần ít nhất 2 nhóm mới có gì để so sánh. */}
            {analysis.groups.length > 1 && (
              <View style={styles.analysis}>
                <View style={styles.analysisHead}>
                  <Ionicons name="pie-chart" size={15} color={colors.primary} />
                  <Text style={styles.analysisTitle}>{t('ml.an_title', 'Phân tích nguyên liệu')}</Text>
                  <Text style={styles.analysisMeta}>
                    {vn(analysis.totalGrams)} g · {analysis.counted} {t('ml.an_items', 'nguyên liệu')}
                  </Text>
                </View>

                <Bar segments={analysis.groups} />

                <View style={styles.groupGrid}>
                  {analysis.groups.map((g) => (
                    <View key={g.id} style={styles.groupRow}>
                      <View style={[styles.dot, { backgroundColor: g.color }]} />
                      <Text style={styles.groupLabel} numberOfLines={1}>{g.label}</Text>
                      <Text style={styles.groupPct}>{Math.round(g.percent)}%</Text>
                    </View>
                  ))}
                </View>

                {analysis.highlights.length > 0 && (
                  <View style={styles.tags}>
                    {analysis.highlights.map((h) => (
                      <View key={h.id} style={[styles.tag, h.tone === 'warn' ? styles.tagWarn : styles.tagGood]}>
                        <Ionicons
                          name={h.tone === 'good' ? 'checkmark-circle' : 'alert-circle'}
                          size={11}
                          color={h.tone === 'good' ? '#2c7a55' : '#8a5a12'}
                        />
                        <Text style={[styles.tagText, { color: h.tone === 'good' ? '#2c7a55' : '#8a5a12' }]}>
                          {h.label} {h.count}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.analysisNote}>
                  {t('ml.an_note', 'Tỉ lệ tính theo khối lượng nguyên liệu, không phải theo năng lượng.')}
                </Text>
              </View>
            )}

            {meals.map((meal) => {
              const dishes = meal.menu_template_dishes || [];
              if (!dishes.length) return null;
              const mealKcal = kcalOf(dishes);

              return (
                <View key={meal.id} style={styles.meal}>
                  <View style={styles.mealHead}>
                    <Ionicons name={MEAL_ICON[meal.meal_type] || 'restaurant'} size={14} color={colors.primary} />
                    <Text style={styles.mealName}>{mealLabel(meal.meal_type)}</Text>
                    {mealKcal > 0 && <Text style={styles.mealKcal}>{vn(Math.round(mealKcal))} kcal</Text>}
                  </View>

                  {/* Nguồn tự đánh dấu bữa này là số liệu CHƯA ĐẦY ĐỦ. Đây là ứng
                      dụng sức khoẻ — không được hiện con số ước tính y như con số
                      đã kiểm chứng. */}
                  {meal.needs_review && (
                    <View style={styles.review}>
                      <Ionicons name="warning" size={13} color={colors.warning} />
                      <Text style={styles.reviewText}>
                        {t('ml.needs_review', 'Nguồn ghi nhận số liệu dinh dưỡng của bữa này chưa đầy đủ — hãy xem như tham khảo.')}
                      </Text>
                    </View>
                  )}

                  {dishes.map((dish) => {
                    const ings = usefulIngredients(dish);
                    const meta = [
                      num(dish.calories) != null ? `${Math.round(dish.calories)} kcal` : null,
                      num(dish.base_grams) != null ? `${Math.round(dish.base_grams)} g` : null,
                      num(dish.protein) != null ? `${t('mp.protein', 'Đạm')} ${Math.round(dish.protein)}g` : null,
                      num(dish.fat) != null ? `${t('mp.fat', 'Béo')} ${Math.round(dish.fat)}g` : null,
                      num(dish.carbs) != null ? `${t('mp.carbs', 'Bột')} ${Math.round(dish.carbs)}g` : null,
                    ].filter(Boolean).join(' · ');

                    return (
                      <View key={dish.id} style={styles.dish}>
                        <Text style={styles.dishName}>{dish.name}</Text>
                        {!!meta && <Text style={styles.dishMeta}>{meta}</Text>}

                        {ings.length > 0 && (
                          <View style={styles.ings}>
                            {ings.map((i) => (
                              <View key={i.id} style={styles.ingRow}>
                                <Text style={styles.ingName} numberOfLines={2}>{i.name}</Text>
                                <Text style={styles.ingQty}>
                                  {i.grams != null ? `${vn(i.grams)} ${i.unit || 'g'}` : '—'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <Text style={styles.footNote}>
              {t('ml.day_modal_note', 'Số liệu dinh dưỡng là ước tính cho một suất, lấy từ tài liệu của đơn vị phát hành. Không thay thế chỉ định của bác sĩ.')}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Legend({ color, label, value }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

function Micro({ value, unit, label }) {
  return (
    <View style={styles.micro}>
      <Text style={styles.microValue}>{value}<Text style={styles.microUnit}>{unit}</Text></Text>
      <Text style={styles.microLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong, marginTop: spacing.md,
  },

  head: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headTitle: { flex: 1, fontSize: font.size.xl, fontWeight: font.weight.heavy, color: colors.textMain },
  headKcal: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.primary },
  close: {
    width: 30, height: 30, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt,
  },

  body: { padding: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },

  track: { flexDirection: 'row', height: 10, borderRadius: radius.full, overflow: 'hidden', backgroundColor: colors.divider },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { fontSize: font.size.sm, color: colors.textSub },
  legendValue: { fontSize: font.size.sm, fontWeight: font.weight.heavy, color: colors.textMain },
  dot: { width: 9, height: 9, borderRadius: 3 },

  note: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.lg,
    borderRadius: radius.md, backgroundColor: colors.infoSoft,
  },
  noteText: { flex: 1, fontSize: font.size.sm, color: colors.textSub, lineHeight: font.size.sm * 1.5 },

  micros: { flexDirection: 'row', gap: spacing.md },
  micro: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  microValue: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.textMain },
  microUnit: { fontSize: font.size.xs, fontWeight: font.weight.semibold, color: colors.textSub },
  microLabel: { fontSize: font.size.xs, color: colors.textSub, marginTop: 2 },

  analysis: {
    padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  analysisHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  analysisTitle: { flex: 1, fontSize: font.size.md, fontWeight: font.weight.heavy, color: colors.textMain },
  analysisMeta: { fontSize: font.size.xs, color: colors.textMuted },
  groupGrid: { gap: 6 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupLabel: { flex: 1, fontSize: font.size.sm, color: colors.textSub },
  groupPct: { fontSize: font.size.sm, fontWeight: font.weight.heavy, color: colors.textMain },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, height: 26, borderRadius: radius.full, borderWidth: 1,
  },
  tagGood: { backgroundColor: 'rgba(76,175,125,0.12)', borderColor: 'rgba(76,175,125,0.3)' },
  tagWarn: { backgroundColor: 'rgba(243,156,18,0.12)', borderColor: 'rgba(243,156,18,0.3)' },
  tagText: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  analysisNote: { fontSize: font.size.xs, color: colors.textMuted, lineHeight: font.size.xs * 1.5 },

  meal: { gap: spacing.sm },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealName: {
    flex: 1, fontSize: font.size.xs, fontWeight: font.weight.heavy,
    color: colors.textSub, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  mealKcal: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textMain },

  review: {
    flexDirection: 'row', gap: 7, padding: spacing.md,
    borderRadius: radius.sm, backgroundColor: colors.warningSoft,
  },
  reviewText: { flex: 1, fontSize: font.size.xs, color: '#8a5a12', lineHeight: font.size.xs * 1.5 },

  dish: {
    padding: spacing.md, borderRadius: radius.md, gap: 4,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  dishName: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.textMain },
  dishMeta: { fontSize: font.size.xs, color: colors.textSub },
  ings: { marginTop: 6, gap: 3, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  ingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  ingName: { flex: 1, fontSize: font.size.sm, color: colors.textSub },
  ingQty: { fontSize: font.size.sm, color: colors.textMain, fontWeight: font.weight.semibold },

  footNote: { fontSize: font.size.xs, color: colors.textMuted, lineHeight: font.size.xs * 1.6 },
});
