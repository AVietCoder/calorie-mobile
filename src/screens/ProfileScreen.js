import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { Button, Card, Field } from '../components/UI';
import { SetupAPI, apiFetch } from '../api/client';
import { colors, radius } from '../theme/colors';

/* ─── Step config khớp setup.html ─── */
const GENDERS = [
  { id: 'male', label: 'Nam' },
  { id: 'female', label: 'Nữ' },
];

const GOALS = [
  { id: 'lose', label: 'Giảm cân', icon: 'trending-down' },
  { id: 'maintain', label: 'Giữ cân', icon: 'remove' },
  { id: 'gain', label: 'Tăng cân', icon: 'trending-up' },
  { id: 'muscle', label: 'Tăng cơ', icon: 'barbell' },
];

const SPEEDS = [
  { id: 'safe', label: 'An toàn (0.5kg/tuần)' },
  { id: 'normal', label: 'Vừa phải (0.7kg/tuần)' },
  { id: 'fast', label: 'Nhanh (1kg/tuần)' },
];

const ACTIVITIES = [
  { id: '1.2', label: 'Ít vận động (Văn phòng)' },
  { id: '1.375', label: 'Nhẹ (1-2 buổi/tuần)' },
  { id: '1.55', label: 'Vừa (3-5 buổi/tuần)' },
  { id: '1.725', label: 'Nặng (6-7 buổi/tuần)' },
];

const SNACKS = [
  { id: 'no', label: 'Không bao giờ' },
  { id: 'sometimes', label: 'Thỉnh thoảng' },
  { id: 'often', label: 'Thường xuyên' },
];

const FOCUS = [
  { id: 'balanced', label: 'Cân bằng' },
  { id: 'high_protein', label: 'Nhiều Đạm' },
  { id: 'low_carb', label: 'Ít Tinh bột' },
];

const INITIAL = {
  gender: 'male', birth_year: '', height: '', weight: '',
  goal: '', target_weight: '', deadline: '', speed: 'safe',
  activity: '1.375', cheat_days: '', snacking: 'sometimes',
  allergies: '', focus_macro: 'balanced', reason: '', streak_goal: '',
};

/* ─── Pill selector ─── */
function PillGroup({ options, value, onChange, columns = 2, withIcon = false }) {
  return (
    <View style={[styles.pillGrid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
      {options.map((opt) => {
        const active = value === opt.id;
        const widthStyle = columns === 2 ? { width: '48%' } : { width: '100%' };
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.pill, widthStyle, active && styles.pillActive]}
          >
            {withIcon && opt.icon && (
              <View style={[styles.pillIcon, active && { backgroundColor: colors.primary }]}>
                <Ionicons name={opt.icon} size={14} color={active ? '#fff' : colors.primary} />
              </View>
            )}
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { checking } = useAuthGuard();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  /* Load dữ liệu cũ (giống loadCurrentData trong setup.html) */
  useEffect(() => {
    if (checking) return;
    (async () => {
      try {
        const result = await apiFetch('/diet-info');
        const p = result?.data?.profile;
        if (p) {
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
            streak_goal: p.streak_goal ? String(p.streak_goal) : '',
            goal: p.goal || '',
          }));
        }
      } catch (e) {
        // chưa có dữ liệu cũ, bỏ qua
      } finally {
        setLoadingData(false);
      }
    })();
  }, [checking]);

  const submit = async () => {
    setSaving(true);
    try {
      await SetupAPI.save(form);
      toast.show('Hoàn tất lộ trình!', 'success');
    } catch (e) {
      toast.show(e.message || 'Có lỗi xảy ra', 'error');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < 3) setStep(step + 1);
    else submit();
  };
  const prev = () => step > 0 && setStep(step - 1);

  const confirmLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  if (checking || loadingData) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.textSub }}>
          {checking ? 'Đang xác thực...' : 'Đang tải hồ sơ...'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header với nút logout */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="leaf" size={20} color={colors.primary} />
          <Text style={styles.brand}>Calorie AI</Text>
        </View>
        <Pressable onPress={confirmLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={16} color="#fff" />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <Card>
            {/* User info mini */}
            <View style={styles.userBox}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.userName}>Chúc bạn ngày mới tốt lành!</Text>
                <Text style={styles.userId}>ID: {user?.id || '—'}</Text>
              </View>
            </View>

            {/* Progress bar 4 step */}
            <View style={styles.progress}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[styles.progressStep, i <= step && styles.progressStepActive]}
                />
              ))}
            </View>

            {/* STEP 1 — Chỉ số cơ thể */}
            {step === 0 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>Chỉ số cơ thể</Text>
                <Text style={styles.psub}>Để tính toán BMR và TDEE chính xác.</Text>

                <Text style={styles.label}>Giới tính</Text>
                <PillGroup options={GENDERS} value={form.gender} onChange={set('gender')} />

                <Field label="Năm sinh" value={form.birth_year}
                  onChangeText={set('birth_year')} keyboardType="number-pad" placeholder="2000" />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Chiều cao (cm)" value={form.height}
                      onChangeText={set('height')} keyboardType="number-pad" placeholder="170" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Cân nặng (kg)" value={form.weight}
                      onChangeText={set('weight')} keyboardType="number-pad" placeholder="65" />
                  </View>
                </View>
              </View>
            )}

            {/* STEP 2 — Mục tiêu */}
            {step === 1 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>Mục tiêu của bạn</Text>
                <Text style={styles.psub}>Bạn muốn đạt được điều gì?</Text>

                <View style={{ marginTop: 8 }}>
                  <PillGroup options={GOALS} value={form.goal} onChange={set('goal')} withIcon />
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Cân nặng mục tiêu" value={form.target_weight}
                      onChangeText={set('target_weight')} keyboardType="number-pad" placeholder="60" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Deadline (YYYY-MM-DD)" value={form.deadline}
                      onChangeText={set('deadline')} placeholder="2025-12-31" />
                  </View>
                </View>

                <Text style={styles.label}>Tốc độ mong muốn</Text>
                <PillGroup options={SPEEDS} value={form.speed} onChange={set('speed')} columns={1} />
              </View>
            )}

            {/* STEP 3 — Thói quen */}
            {step === 2 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>Thói quen & Linh hoạt</Text>
                <Text style={styles.psub}>Tối ưu hóa calo theo lịch trình của bạn.</Text>

                <Text style={styles.label}>Tần suất vận động</Text>
                <PillGroup options={ACTIVITIES} value={form.activity}
                  onChange={set('activity')} columns={1} />

                <Field label="Ngày ăn nhiều (Cheat day)" value={form.cheat_days}
                  onChangeText={set('cheat_days')} placeholder="Thứ 7 và Chủ Nhật" />

                <Text style={styles.label}>Bạn có hay ăn vặt không?</Text>
                <PillGroup options={SNACKS} value={form.snacking} onChange={set('snacking')} columns={1} />
              </View>
            )}

            {/* STEP 4 — Cá nhân hoá */}
            {step === 3 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>Cá nhân hóa sâu</Text>
                <Text style={styles.psub}>Bước cuối cùng để hoàn tất lộ trình.</Text>

                <Field label="Dị ứng / Thực phẩm không ăn được"
                  value={form.allergies} onChangeText={set('allergies')}
                  placeholder="Không ăn hành, dị ứng hải sản..." multiline />

                <Text style={styles.label}>Tập trung vào chất nào?</Text>
                <PillGroup options={FOCUS} value={form.focus_macro}
                  onChange={set('focus_macro')} columns={1} />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Lý do bắt đầu" value={form.reason}
                      onChangeText={set('reason')} placeholder="Cải thiện sức khỏe..." />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Mục tiêu Streak" value={form.streak_goal}
                      onChangeText={set('streak_goal')} keyboardType="number-pad" placeholder="30" />
                  </View>
                </View>
              </View>
            )}

            {/* Nav buttons */}
            <View style={styles.btnRow}>
              {step > 0 ? (
                <Button title="Quay lại" variant="ghost" onPress={prev} />
              ) : <View />}
              <Button
                title={step === 3 ? 'Hoàn tất lộ trình' : 'Tiếp tục'}
                onPress={next}
                loading={saving}
                icon={<Ionicons name={step === 3 ? 'checkmark' : 'arrow-forward'}
                  size={16} color="#fff" />}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  brand: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  userBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f1',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  userId: { fontSize: 12, color: colors.textSub, marginTop: 2 },

  progress: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressStep: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#eee' },
  progressStepActive: { backgroundColor: colors.primary },

  h2: { fontSize: 20, fontWeight: '800', color: colors.textMain },
  psub: { color: colors.textSub, fontSize: 13, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 12, marginBottom: 8 },

  pillGrid: { gap: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: '#e5e7e5',
    backgroundColor: '#fafbfa',
  },
  pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pillIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textMain, flex: 1 },
  pillTextActive: { color: colors.primaryDark },

  btnRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 24, gap: 12,
  },
});
