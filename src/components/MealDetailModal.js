// src/components/MealDetailModal.js
// Chi tiết bữa ăn: dinh dưỡng + thanh macro + hành động Ăn / Đổi món / Bỏ bữa
// + Tìm quán gần đây + Hỏi HLV AI. Port từ web schedule.html (meal modal).
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, ScrollView, StyleSheet, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme/colors';
import { useI18n } from '../i18n';

const num = (v) => {
  if (v == null || v === '' || v === 'N/A') return null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
};

export default function MealDetailModal({
  visible, item, isToday, skipped, onClose,
  onEat, onSkip, onChange, onAskAI,
}) {
  const { t, localizeFood } = useI18n();
  const [action, setAction] = useState('eat'); // eat | change | skip
  const [alt, setAlt] = useState('');

  useEffect(() => {
    if (visible) {
      setAction(skipped ? 'skip' : 'eat');
      setAlt('');
    }
  }, [visible, item, skipped]);

  if (!item) return null;

  const p = num(item.protein);
  const f = num(item.fat);
  const c = num(item.carbs);
  let pPct = 0, fPct = 0, cPct = 0;
  if (p != null && f != null && c != null) {
    const pk = p * 4, fk = f * 9, ck = c * 4;
    const total = pk + fk + ck || 1;
    pPct = (pk / total) * 100; fPct = (fk / total) * 100; cPct = (ck / total) * 100;
  }

  const findNearby = () => {
    const q = encodeURIComponent(`${item.food || ''} gần đây`);
    Linking.openURL(`https://www.google.com/maps/search/${q}`).catch(() => {});
  };

  const submit = () => {
    if (action === 'change') {
      const food = alt.trim();
      if (food) onChange?.(item, food);
    } else if (action === 'skip') {
      onSkip?.(item, true);
    } else {
      onEat?.(item);
    }
    onClose?.();
  };

  const detailRows = [
    ['fitness', '#5b9cf6', 'chat.protein', 'Protein', item.protein],
    ['water', '#f5a623', 'chat.fat', 'Chất béo', item.fat],
    ['nutrition', '#7dc976', 'chat.carbs', 'Carbs', item.carbs],
    ['leaf', '#9b7edb', 'chat.fiber', 'Chất xơ', item.fiber],
    ['ice-cream', '#e07ca0', 'chat.sugar', 'Đường', item.sugar],
    ['flask', '#7090d0', 'chat.sodium', 'Natri', item.sodium],
  ].filter((r) => r[4] != null && r[4] !== '');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.foodName}>{localizeFood(item.food) || '—'}</Text>
              <View style={styles.mealBadge}>
                <Ionicons name="restaurant" size={12} color={colors.primaryDark} />
                <Text style={styles.mealBadgeText}>{item.meal || '—'}</Text>
              </View>
            </View>

            {/* Actions: Ăn / Đổi / Bỏ */}
            <View style={styles.actionGroup}>
              <ActionOpt
                active={action === 'eat'} color={colors.primary}
                icon="checkmark-circle" label={t('sch.opt_eat', 'Tôi sẽ ăn món này')}
                onPress={() => setAction('eat')}
              />
              <ActionOpt
                active={action === 'change'} color={colors.info}
                icon="swap-horizontal" label={t('sch.opt_change', 'Đổi sang món khác')}
                onPress={() => setAction('change')}
              />
              {isToday && (
                <ActionOpt
                  active={action === 'skip'} color={colors.danger}
                  icon="ban" label={t('sch.opt_skip', 'Tôi sẽ không ăn bữa này')}
                  onPress={() => setAction('skip')}
                />
              )}
            </View>

            {action === 'change' && (
              <TextInput
                value={alt} onChangeText={setAlt}
                placeholder={t('sch.alt_ph', 'Bạn muốn ăn món gì khác?')}
                placeholderTextColor={colors.muted}
                style={styles.altInput}
              />
            )}
            {action === 'skip' && (
              <View style={styles.skipNote}>
                <Ionicons name="ban" size={14} color={colors.danger} />
                <Text style={styles.skipNoteText}>{t('sch.skip_saved', 'Đã đánh dấu bỏ bữa này')}</Text>
              </View>
            )}

            {/* Kcal lớn */}
            <View style={styles.kcalBox}>
              <Text style={styles.kcalFire}>🔥</Text>
              <View>
                <Text style={styles.kcalNum}>{item.calories != null ? item.calories : '—'}</Text>
                <Text style={styles.kcalUnit}>kcal · {item.amount || '—'}</Text>
              </View>
            </View>

            {/* Thanh macro */}
            {(p != null && f != null && c != null) && (
              <View style={styles.macroWrap}>
                <Text style={styles.macroLabel}>{t('sch.nutrition_struct', 'Cơ cấu dinh dưỡng')}</Text>
                <View style={styles.macroTrack}>
                  <View style={{ width: `${pPct}%`, backgroundColor: '#5b9cf6' }} />
                  <View style={{ width: `${fPct}%`, backgroundColor: '#f5a623' }} />
                  <View style={{ width: `${cPct}%`, backgroundColor: '#7dc976' }} />
                </View>
                <View style={styles.legendRow}>
                  <Legend color="#5b9cf6" label={`P ${item.protein || '—'}`} />
                  <Legend color="#f5a623" label={`F ${item.fat || '—'}`} />
                  <Legend color="#7dc976" label={`C ${item.carbs || '—'}`} />
                </View>
              </View>
            )}

            {/* Bảng chi tiết */}
            <View style={styles.table}>
              {detailRows.map(([icon, col, key, fb, val], i) => (
                <View key={i} style={[styles.tableRow, i === detailRows.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.tableLeft}>
                    <View style={[styles.tableIcon, { backgroundColor: col + '22' }]}>
                      <Ionicons name={icon} size={14} color={col} />
                    </View>
                    <Text style={styles.tableName}>{t(key, fb)}</Text>
                  </View>
                  <Text style={styles.tableVal}>{val}</Text>
                </View>
              ))}
            </View>

            {/* Nút hành động phụ */}
            <View style={styles.btnRow}>
              <Pressable onPress={findNearby} style={[styles.actBtn, styles.actBtnGhost]}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.actBtnGhostText}>{t('sch.find_near', 'Tìm quán gần đây')}</Text>
              </Pressable>
              <Pressable onPress={() => { onAskAI?.(item); onClose?.(); }} style={[styles.actBtn, styles.actBtnGhost]}>
                <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
                <Text style={styles.actBtnGhostText}>{t('sch.ask_ai', 'Hỏi HLV AI')}</Text>
              </Pressable>
            </View>

            {/* Lưu */}
            <Pressable
              onPress={submit}
              disabled={action === 'change' && !alt.trim()}
              style={[styles.saveBtn, action === 'change' && !alt.trim() && { opacity: 0.5 }]}
            >
              <Ionicons name="save-outline" size={16} color="#fff" />
              <Text style={styles.saveText}>{t('common.save', 'Lưu thay đổi')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ActionOpt({ active, color, icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.opt, active && { borderColor: color, backgroundColor: color + '14' }]}>
      <Ionicons name={icon} size={18} color={active ? color : colors.muted} />
      <Text style={[styles.optText, active && { color, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

function Legend({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(45,52,54,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, maxHeight: '88%', ...shadow.card,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  foodName: { flex: 1, fontSize: 19, fontWeight: '800', color: colors.textMain },
  mealBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  mealBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  actionGroup: { gap: 8, marginBottom: 10 },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13,
  },
  optText: { fontSize: 14, color: colors.textSub },
  altInput: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eee', borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 13, fontSize: 15, color: colors.textMain, marginBottom: 10,
  },
  skipNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FDECEA', borderRadius: 10, padding: 11, marginBottom: 10,
  },
  skipNoteText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  kcalBox: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FBF7EE', borderRadius: 14, padding: 16, marginBottom: 14,
  },
  kcalFire: { fontSize: 28 },
  kcalNum: { fontSize: 28, fontWeight: '800', color: colors.textMain },
  kcalUnit: { fontSize: 13, color: colors.textSub, marginTop: 2 },
  macroWrap: { marginBottom: 14 },
  macroLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub, marginBottom: 8 },
  macroTrack: { flexDirection: 'row', height: 14, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F0F0F0' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSub, fontWeight: '600' },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
  },
  tableLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tableIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tableName: { fontSize: 14, color: colors.textMain },
  tableVal: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  actBtnGhost: { backgroundColor: colors.primarySoft },
  actBtnGhostText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
