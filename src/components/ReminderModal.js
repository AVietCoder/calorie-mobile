// src/components/ReminderModal.js
// Bảng quản lý nhắc nhở + chuông báo nổi (port từ web reminders.js).
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radius, shadow } from '../theme/colors';
import { useI18n } from '../i18n';
import { useReminders } from '../context/ReminderContext';
import { useToast } from './Toast';

function fmtTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ── Bảng quản lý nhắc nhở ─────────────────────────────────────── */
export function ReminderManager({ visible, onClose }) {
  const { t } = useI18n();
  const { reminders, add, remove } = useReminders();
  const toast = useToast();

  const [tab, setTab] = useState('meal'); // 'meal' | 'med'
  const [label, setLabel] = useState('');
  const [time, setTime] = useState(new Date());
  const [repeat, setRepeat] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => { if (!visible) { setLabel(''); } }, [visible]);

  const items = reminders
    .filter((r) => r.type === tab)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const onAdd = async () => {
    const tstr = fmtTime(time);
    await add({
      type: tab,
      label: label.trim() || (tab === 'med' ? t('rem.tab_med', 'Uống thuốc') : t('rem.tab_meal', 'Bữa ăn')),
      time: tstr,
      repeat,
    });
    setLabel('');
    toast.show(t('rem.saved', 'Đã lưu nhắc nhở'), 'success');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>{t('rem.title', 'Nhắc nhở')}</Text>
              <Text style={styles.headSub}>{t('rem.subtitle', 'Nhắc uống thuốc & ăn đúng giờ')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textSub} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {[['meal', t('rem.tab_meal', 'Bữa ăn'), 'restaurant'], ['med', t('rem.tab_med', 'Uống thuốc'), 'medkit']].map(
              ([id, lab, icon]) => (
                <Pressable
                  key={id}
                  onPress={() => setTab(id)}
                  style={[styles.tab, tab === id && styles.tabActive]}
                >
                  <Ionicons name={icon} size={15} color={tab === id ? colors.primaryDark : colors.textSub} />
                  <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{lab}</Text>
                </Pressable>
              )
            )}
          </View>

          <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 8 }}>
            {items.length === 0 ? (
              <Text style={styles.empty}>{t('rem.none', 'Chưa có nhắc nhở nào.')}</Text>
            ) : (
              items.map((r) => (
                <View key={r.id} style={styles.item}>
                  <Text style={styles.itemTime}>{r.time}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLabel}>{r.label}</Text>
                    <Text style={styles.itemRep}>
                      {r.repeat ? t('rem.repeat', 'Lặp lại hằng ngày') : t('common.today', 'Hôm nay')}
                    </Text>
                  </View>
                  <Pressable onPress={() => remove(r.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>

          {/* Form thêm */}
          <View style={styles.form}>
            <Text style={styles.formLabel}>{t('rem.label', 'Nội dung nhắc')}</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={tab === 'med' ? t('rem.label_med_ph', 'VD: Uống vitamin D') : t('rem.label_meal_ph', 'VD: Ăn sáng')}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>{t('rem.time', 'Giờ nhắc')}</Text>
                <Pressable onPress={() => setShowPicker(true)} style={styles.timeBtn}>
                  <Ionicons name="time-outline" size={18} color={colors.textMain} />
                  <Text style={styles.timeText}>{fmtTime(time)}</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setRepeat((v) => !v)} style={styles.repeatRow}>
                <Ionicons
                  name={repeat ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={repeat ? colors.primary : colors.muted}
                />
                <Text style={styles.repeatText}>{t('rem.repeat', 'Lặp lại hằng ngày')}</Text>
              </Pressable>
            </View>

            {showPicker && (
              <DateTimePicker
                value={time}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, d) => { setShowPicker(false); if (d) setTime(d); }}
              />
            )}

            <Pressable onPress={onAdd} style={styles.addBtn}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addText}>{t('rem.add', 'Thêm nhắc nhở')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Chuông báo nổi giữa màn hình ──────────────────────────────── */
export function AlarmModal() {
  const { t } = useI18n();
  const { alarm, dismissAlarm } = useReminders();
  const isMed = alarm?.type === 'med';

  return (
    <Modal visible={!!alarm} transparent animationType="fade" onRequestClose={dismissAlarm}>
      <View style={styles.alarmOverlay}>
        <View style={styles.alarmCard}>
          <Pressable style={styles.alarmX} onPress={dismissAlarm} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </Pressable>
          <View style={[styles.alarmIcon, isMed && { backgroundColor: '#C9A227' }]}>
            <MaterialCommunityIcons name={isMed ? 'pill' : 'silverware-fork-knife'} size={36} color="#fff" />
          </View>
          <Text style={styles.alarmNow}>{t('rem.alarm_now', 'BÂY GIỜ')}</Text>
          <Text style={styles.alarmTitle}>
            {isMed ? t('rem.fire_med', '💊 Đến giờ uống thuốc') : t('rem.fire_meal', '🍽️ Đến giờ ăn')}
          </Text>
          <Text style={styles.alarmBody}>
            {alarm?.label
              || (isMed ? t('rem.alarm_default_med', 'Đã đến giờ uống thuốc của bạn.')
                        : t('rem.alarm_default_meal', 'Đã đến giờ ăn của bạn.'))}
          </Text>
          <Text style={styles.alarmTime}>{alarm?.time || ''}</Text>
          <Pressable onPress={dismissAlarm} style={styles.alarmDismiss}>
            <Text style={styles.alarmDismissText}>{t('rem.alarm_dismiss', 'Đã hiểu')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(45,52,54,0.45)', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingBottom: 28, ...shadow.card,
  },
  head: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 20, paddingBottom: 12,
  },
  headTitle: { fontSize: 18, fontWeight: '800', color: colors.primaryDark },
  headSub: { fontSize: 12.5, color: colors.textSub, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: '#F9FBF9',
  },
  tabActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  tabTextActive: { color: colors.primaryDark },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: 14, fontSize: 13 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, padding: 11, borderRadius: 12,
    backgroundColor: '#F9FBF9', borderWidth: 1, borderColor: colors.border,
  },
  itemTime: { fontWeight: '800', color: colors.primaryDark, fontSize: 15, minWidth: 50 },
  itemLabel: { fontWeight: '600', fontSize: 13.5, color: colors.textMain },
  itemRep: { fontSize: 11, color: colors.muted, marginTop: 1 },
  form: { paddingHorizontal: 20, paddingTop: 14, gap: 8 },
  formLabel: { fontSize: 12, fontWeight: '600', color: colors.textSub, marginBottom: 4 },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eee',
    borderRadius: 10, paddingVertical: 11, paddingHorizontal: 13, fontSize: 15, color: colors.textMain,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  timeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eee', borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 13,
  },
  timeText: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 11, flex: 1 },
  repeatText: { fontSize: 12.5, color: colors.textSub, flexShrink: 1 },
  addBtn: {
    marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13,
  },
  addText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  /* Alarm */
  alarmOverlay: { flex: 1, backgroundColor: 'rgba(45,52,54,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  alarmCard: {
    width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 24,
    padding: 28, paddingTop: 34, alignItems: 'center', ...shadow.card,
  },
  alarmX: { position: 'absolute', top: 12, right: 12, padding: 6 },
  alarmIcon: {
    width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, marginBottom: 16,
  },
  alarmNow: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: colors.primaryDark,
    backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, overflow: 'hidden',
  },
  alarmTitle: { fontSize: 20, fontWeight: '800', color: colors.textMain, marginTop: 10, textAlign: 'center' },
  alarmBody: { fontSize: 14.5, color: colors.textSub, marginTop: 6, textAlign: 'center', lineHeight: 21 },
  alarmTime: { fontSize: 30, fontWeight: '800', color: colors.primaryDark, marginVertical: 16 },
  alarmDismiss: { width: '100%', backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  alarmDismissText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
