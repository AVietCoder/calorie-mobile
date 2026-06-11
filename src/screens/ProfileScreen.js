import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useI18n } from '../i18n';
import { LangSwitch } from '../components/HeaderWidgets';

import { Button, Card, Field } from '../components/UI';
import { SetupAPI, apiFetch } from '../api/client';
import { colors, radius } from '../theme/colors';

/* ── option lists (label lấy qua i18n trong render) ── */
const GENDERS = [
  { id: 'male', key: 'setup.male', label: 'Nam' },
  { id: 'female', key: 'setup.female', label: 'Nữ' },
];
const GOALS = [
  { id: 'lose', key: 'setup.goal_lose', label: 'Giảm cân', icon: 'trending-down' },
  { id: 'maintain', key: 'setup.goal_maintain', label: 'Giữ cân', icon: 'remove' },
  { id: 'gain', key: 'setup.goal_gain', label: 'Tăng cân', icon: 'trending-up' },
  { id: 'muscle', key: 'setup.goal_muscle', label: 'Tăng cơ', icon: 'barbell' },
  { id: 'disease', key: 'setup.goal_disease', label: 'Hỗ trợ điều trị bệnh', icon: 'medkit' },
];
const DISEASES = [
  { v: 'Gout', key: 'disease.gout' },
  { v: 'Tiểu đường', key: 'disease.diabetes' },
  { v: 'Huyết áp cao', key: 'disease.hypertension' },
  { v: 'Mỡ máu cao', key: 'disease.high_cholesterol' },
  { v: 'Gan nhiễm mỡ', key: 'disease.fatty_liver' },
  { v: 'Bệnh dạ dày', key: 'disease.stomach' },
  { v: 'Bệnh thận', key: 'disease.kidney' },
  { v: 'Khác', key: 'disease.other' },
];
const DISEASE_VALUES = DISEASES.map((x) => x.v);
const SPEEDS = [
  { id: 'safe', key: 'setup.speed_safe', label: 'An toàn (0.5kg/tuần)' },
  { id: 'normal', key: 'setup.speed_normal', label: 'Vừa phải (0.7kg/tuần)' },
  { id: 'fast', key: 'setup.speed_fast', label: 'Nhanh (1kg/tuần)' },
];
const ACTIVITIES = [
  { id: '1.2', key: 'setup.act_1', label: 'Ít vận động (Văn phòng)' },
  { id: '1.375', key: 'setup.act_2', label: 'Nhẹ (1-2 buổi/tuần)' },
  { id: '1.55', key: 'setup.act_3', label: 'Vừa (3-5 buổi/tuần)' },
  { id: '1.725', key: 'setup.act_4', label: 'Nặng (6-7 buổi/tuần)' },
];
const SNACKS = [
  { id: 'no', key: 'setup.snack_no', label: 'Không bao giờ' },
  { id: 'sometimes', key: 'setup.snack_sometimes', label: 'Thỉnh thoảng' },
  { id: 'often', key: 'setup.snack_often', label: 'Thường xuyên' },
];
const FOCUS = [
  { id: 'balanced', key: 'setup.focus_balanced', label: 'Cân bằng' },
  { id: 'high_protein', key: 'setup.focus_protein', label: 'Nhiều Đạm' },
  { id: 'low_carb', key: 'setup.focus_lowcarb', label: 'Ít Tinh bột' },
];

const INITIAL = {
  gender: 'male', birth_year: '', height: '', weight: '',
  goals: [], disease: '', custom_disease: '',
  target_weight: '', deadline: '', speed: 'safe',
  activity: '1.375', cheat_days: '', snacking: 'sometimes',
  allergies: '', focus_macro: 'balanced', reason: '',
};

/* ── single-select pill group ── */
function PillGroup({ options, value, onChange, columns = 2, withIcon = false, t }) {
  return (
    <View style={styles.pillGrid}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.pill, columns === 2 ? { width: '48%' } : { width: '100%' }, active && styles.pillActive]}
          >
            {withIcon && opt.icon && (
              <View style={[styles.pillIcon, active && { backgroundColor: colors.primary }]}>
                <Ionicons name={opt.icon} size={14} color={active ? '#fff' : colors.primary} />
              </View>
            )}
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{t(opt.key, opt.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── multi-select pill group (mục tiêu) ── */
function PillMultiGroup({ options, values, onToggle, columns = 2, withIcon = false, t }) {
  return (
    <View style={styles.pillGrid}>
      {options.map((opt) => {
        const active = values.includes(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => onToggle(opt.id)}
            style={[styles.pill, columns === 2 ? { width: '48%' } : { width: '100%' }, active && styles.pillActive]}
          >
            {withIcon && opt.icon && (
              <View style={[styles.pillIcon, active && { backgroundColor: colors.primary }]}>
                <Ionicons name={opt.icon} size={14} color={active ? '#fff' : colors.primary} />
              </View>
            )}
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{t(opt.key, opt.label)}</Text>
            {active && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { checking } = useAuthGuard();
  const { t } = useI18n();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [extendMode, setExtendMode] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);

  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const hasDisease = form.goals.includes('disease');
  const finalDisease = hasDisease
    ? (form.disease === 'Khác' ? form.custom_disease.trim() : form.disease)
    : '';

  const toggleGoal = (goal) => {
    setForm((s) => {
      const exists = s.goals.includes(goal);
      const goals = exists ? s.goals.filter((g) => g !== goal) : [...s.goals, goal];
      return {
        ...s,
        goals,
        disease: goals.includes('disease') ? s.disease : '',
        custom_disease: goals.includes('disease') ? s.custom_disease : '',
      };
    });
  };

  useEffect(() => {
    if (checking) return;
    (async () => {
      try {
        const result = await apiFetch('/diet-info');
        const p = result?.data?.profile;
        if (p) {
          const goals = String(p.goal || '').split(',').map((g) => g.trim()).filter(Boolean);
          setForm((s) => ({
            ...s,
            gender: p.gender || s.gender,
            birth_year: p.birth_year ? String(p.birth_year) : '',
            height: p.height ? String(p.height) : '',
            weight: p.weight ? String(p.weight) : '',
            target_weight: p.target_weight ? String(p.target_weight) : '',
            deadline: p.deadline || '',
            speed: p.speed || s.speed,
            activity: p.activity_level ? String(p.activity_level) : s.activity,
            cheat_days: p.high_cal_days || '',
            snacking: p.snacking || s.snacking,
            allergies: p.allergies || '',
            focus_macro: p.focus_macro || s.focus_macro,
            reason: p.reason || '',
            goals,
          }));

          if (p.deadline) {
            const dd = new Date(p.deadline);
            dd.setHours(23, 59, 59, 999);
            setExtendMode(new Date() > dd);
          }

          if (goals.includes('disease')) {
            const predefined = DISEASE_VALUES.includes(p.disease);
            setForm((s) => predefined
              ? { ...s, disease: p.disease, custom_disease: '' }
              : { ...s, disease: 'Khác', custom_disease: p.disease || '' });
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [checking]); // eslint-disable-line

  const validate = () => {
    if (step === 0) {
      if (!form.birth_year || !form.height || !form.weight) {
        toast.show(t('m.fill_all', 'Vui lòng nhập đầy đủ chỉ số'), 'error');
        return false;
      }
    }
    if (step === 1) {
      if (form.goals.length === 0) {
        toast.show(t('setup.pick_goal', 'Vui lòng chọn ít nhất một mục tiêu.'), 'error');
        return false;
      }
      if (hasDisease && !finalDisease) {
        toast.show(t('setup.disease_other_ph', 'Vui lòng nhập bệnh lý'), 'error');
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    setSaving(true);
    try {
      const goalStr = form.goals.join(',');
      const payload = {
        gender: form.gender,
        birth_year: form.birth_year,
        height: form.height,
        weight: form.weight,
        target_weight: form.target_weight,
        deadline: form.deadline,
        speed: form.speed,
        // gửi cả 2 tên field: web dùng `activity`, server đọc `activity_level`
        activity: form.activity,
        activity_level: form.activity,
        cheat_days: form.cheat_days,
        high_cal_days: form.cheat_days,
        snacking: form.snacking,
        allergies: form.allergies,
        focus_macro: form.focus_macro,
        reason: form.reason,
        goal: goalStr,
        disease: hasDisease ? finalDisease : '',
      };
      await SetupAPI.save(payload);
      toast.show(t('m.done', 'Hoàn tất!'), 'success');
      // Quay về tab Dinh dưỡng để xem kết quả
      navigation?.navigate?.('Diet');
    } catch (e) {
      toast.show(e.message || t('m.have_error', 'Có lỗi xảy ra'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const next = () => { if (!validate()) return; step < 3 ? setStep(step + 1) : submit(); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  const confirmLogout = () => {
    Alert.alert(
      t('common.logout', 'Đăng xuất'),
      t('m.confirm_logout', 'Bạn chắc chắn muốn đăng xuất?'),
      [
        { text: t('m.cancel', 'Huỷ'), style: 'cancel' },
        { text: t('common.logout', 'Đăng xuất'), style: 'destructive', onPress: logout },
      ]
    );
  };

  if (checking || loadingData) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.textSub }}>
          {checking ? t('m.auth_checking', 'Đang xác thực...') : t('m.loading', 'Đang tải hồ sơ...')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons name="leaf" size={20} color={colors.primary} />
          <Text style={styles.brand}>Calorie AI</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LangSwitch />
          <Pressable onPress={confirmLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={16} color="#fff" />
            <Text style={styles.logoutText}>{t('common.logout', 'Đăng xuất')}</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {extendMode && (
            <View style={styles.extendBanner}>
              <Ionicons name="medal" size={18} color={colors.primaryDark} />
              <Text style={styles.extendText}>{t('setup.extend_banner', 'Chặng đường cũ đã hoàn thành. Hãy cập nhật cân nặng mới và đặt deadline mới nhé!')}</Text>
            </View>
          )}

          <Card>
            <View style={styles.userBox}>
              <View style={styles.avatar}><Ionicons name="person" size={22} color="#fff" /></View>
              <View>
                <Text style={styles.userName}>{extendMode ? t('m.welcome_back', 'Bắt đầu lộ trình mới') : t('setup.body_title', 'Thiết lập lộ trình')}</Text>
                <Text style={styles.userId}>ID: {user?.id || '—'}</Text>
              </View>
            </View>

            <View style={styles.progress}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.progressStep, i <= step && styles.progressStepActive]} />
              ))}
            </View>

            {/* STEP 1 */}
            {step === 0 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>{t('setup.body_title', 'Chỉ số cơ thể')}</Text>
                <Text style={styles.psub}>{t('setup.body_desc', 'Để tính toán BMR và TDEE chính xác.')}</Text>
                <Text style={styles.label}>{t('setup.gender', 'Giới tính')}</Text>
                <PillGroup options={GENDERS} value={form.gender} onChange={set('gender')} t={t} />
                <Field label={t('setup.birth', 'Năm sinh')} value={form.birth_year} onChangeText={set('birth_year')} keyboardType="number-pad" placeholder="2000" />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('setup.height', 'Chiều cao (cm)')} value={form.height} onChangeText={set('height')} keyboardType="number-pad" placeholder="170" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={t('setup.weight', 'Cân nặng (kg)')} value={form.weight} onChangeText={set('weight')} keyboardType="number-pad" placeholder="65" />
                  </View>
                </View>
              </View>
            )}

            {/* STEP 2 */}
            {step === 1 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>{t('setup.goal_title', 'Mục tiêu của bạn')}</Text>
                <Text style={styles.psub}>{t('setup.goal_desc', 'Bạn có thể chọn nhiều mục tiêu cùng lúc.')}</Text>
                <View style={{ marginTop: 8 }}>
                  <PillMultiGroup options={GOALS} values={form.goals} onToggle={toggleGoal} withIcon t={t} />
                </View>

                {hasDisease && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.label}>{t('setup.disease_label', 'Bệnh / tình trạng sức khỏe')}</Text>
                    <View style={styles.selectWrap}>
                      <View style={styles.pickerContainer}>
                        <Picker selectedValue={form.disease} onValueChange={set('disease')} style={styles.picker} dropdownIconColor={colors.primary}>
                          <Picker.Item label={t('setup.disease_pick', '-- Chọn bệnh --')} value="" />
                          {DISEASES.map((d) => (<Picker.Item key={d.v} label={t(d.key, d.v)} value={d.v} />))}
                        </Picker>
                        <Ionicons name="chevron-down" size={18} color={colors.primary} style={styles.pickerIcon} />
                      </View>
                    </View>
                    {form.disease === 'Khác' && (
                      <Field label={t('setup.disease_label', 'Tên bệnh')} value={form.custom_disease} onChangeText={set('custom_disease')} placeholder={t('setup.disease_other_ph', 'Nhập tên bệnh...')} />
                    )}
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('setup.target_weight', 'Cân nặng mục tiêu')} value={form.target_weight} onChangeText={set('target_weight')} keyboardType="number-pad" placeholder="60" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('setup.deadline', 'Deadline')}</Text>
                    <Pressable onPress={() => setShowDeadline(true)} style={styles.dateBtn}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textMain} />
                      <Text style={{ color: form.deadline ? colors.textMain : colors.muted }}>{form.deadline || 'YYYY-MM-DD'}</Text>
                    </Pressable>
                  </View>
                </View>
                {showDeadline && (
                  <DateTimePicker
                    value={form.deadline ? new Date(form.deadline) : new Date(Date.now() + 30 * 86400000)}
                    mode="date" display="default" minimumDate={new Date()}
                    onChange={(e, d) => { setShowDeadline(false); if (d) set('deadline')(d.toISOString().slice(0, 10)); }}
                  />
                )}

                <Text style={styles.label}>{t('setup.speed', 'Tốc độ mong muốn')}</Text>
                <PillGroup options={SPEEDS} value={form.speed} onChange={set('speed')} columns={1} t={t} />
              </View>
            )}

            {/* STEP 3 */}
            {step === 2 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>{t('setup.habit_title', 'Thói quen & Linh hoạt')}</Text>
                <Text style={styles.psub}>{t('setup.habit_desc', 'Tối ưu hóa calo theo lịch trình của bạn.')}</Text>
                <Text style={styles.label}>{t('setup.activity', 'Tần suất vận động')}</Text>
                <PillGroup options={ACTIVITIES} value={form.activity} onChange={set('activity')} columns={1} t={t} />
                <Field label={t('setup.cheat', 'Ngày ăn nhiều (Cheat day)')} value={form.cheat_days} onChangeText={set('cheat_days')} placeholder={t('setup.cheat_ph', 'Thứ 7 và Chủ Nhật')} />
                <Text style={styles.label}>{t('setup.snack_q', 'Bạn có hay ăn vặt không?')}</Text>
                <PillGroup options={SNACKS} value={form.snacking} onChange={set('snacking')} columns={1} t={t} />
              </View>
            )}

            {/* STEP 4 */}
            {step === 3 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>{t('setup.deep_title', 'Cá nhân hóa sâu')}</Text>
                <Text style={styles.psub}>{t('setup.deep_desc', 'Bước cuối cùng để hoàn tất lộ trình.')}</Text>
                <Field label={t('setup.allergies', 'Dị ứng / Thực phẩm không ăn được')} value={form.allergies} onChangeText={set('allergies')} placeholder={t('setup.allergies_ph', 'Không ăn hành, dị ứng hải sản...')} multiline />
                <Text style={styles.label}>{t('setup.focus_q', 'Tập trung vào chất nào?')}</Text>
                <PillGroup options={FOCUS} value={form.focus_macro} onChange={set('focus_macro')} columns={1} t={t} />
                <Field label={t('setup.reason', 'Lý do bắt đầu')} value={form.reason} onChangeText={set('reason')} placeholder={t('setup.reason_ph', 'Cải thiện sức khỏe...')} />
              </View>
            )}

            {/* BUTTONS */}
            <View style={styles.btnRow}>
              {step > 0 ? (
                <Button title={t('setup.prev', 'Quay lại')} variant="ghost" onPress={prev} />
              ) : (<View />)}
              <Button
                title={step === 3 ? t('setup.finish', 'Hoàn tất lộ trình') : t('setup.next', 'Tiếp tục')}
                onPress={next}
                loading={saving}
                icon={<Ionicons name={step === 3 ? 'checkmark' : 'arrow-forward'} size={16} color="#fff" />}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  extendBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft,
    padding: 16, borderRadius: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.primary,
  },
  extendText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  userBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f1' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  userId: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressStep: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#eee' },
  progressStepActive: { backgroundColor: colors.primary },
  h2: { fontSize: 20, fontWeight: '800', color: colors.textMain },
  psub: { color: colors.textSub, fontSize: 13, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 12, marginBottom: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#eee', borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14,
  },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: '#e5e7e5', backgroundColor: '#fafbfa',
  },
  pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pillIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textMain, flex: 1 },
  pillTextActive: { color: colors.primaryDark },
  selectWrap: {
    marginTop: 8, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5, borderColor: '#dfe7df',
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  picker: { color: colors.textMain },
  pickerContainer: { position: 'relative', justifyContent: 'center' },
  pickerIcon: { position: 'absolute', right: 14, zIndex: 10 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, gap: 12 },
});
