import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useAuthGuard } from '../hooks/useAuthGuard';

import { Button, Card, Field } from '../components/UI';

import { SetupAPI, apiFetch } from '../api/client';
import { colors, radius } from '../theme/colors';

/* ───────────────────────────────────────────── */

const GENDERS = [
  { id: 'male', label: 'Nam' },
  { id: 'female', label: 'Nữ' },
];

const GOALS = [
  { id: 'lose', label: 'Giảm cân', icon: 'trending-down' },
  { id: 'maintain', label: 'Giữ cân', icon: 'remove' },
  { id: 'gain', label: 'Tăng cân', icon: 'trending-up' },
  { id: 'muscle', label: 'Tăng cơ', icon: 'barbell' },
  { id: 'disease', label: 'Hỗ trợ điều trị bệnh', icon: 'medkit' },
];

const DISEASES = [
  'Gout',
  'Tiểu đường',
  'Huyết áp cao',
  'Mỡ máu cao',
  'Gan nhiễm mỡ',
  'Bệnh dạ dày',
  'Bệnh thận',
  'Khác',
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
  gender: 'male',
  birth_year: '',
  height: '',
  weight: '',

  goal: '',
  disease: '',
  custom_disease: '',

  target_weight: '',
  deadline: '',
  speed: 'safe',

  activity: '1.375',
  cheat_days: '',
  snacking: 'sometimes',

  allergies: '',
  focus_macro: 'balanced',
  reason: '',
};

/* ───────────────────────────────────────────── */

function PillGroup({
  options,
  value,
  onChange,
  columns = 2,
  withIcon = false,
}) {
  return (
    <View style={styles.pillGrid}>
      {options.map((opt) => {
        const active = value === opt.id;

        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[
              styles.pill,
              columns === 2 ? { width: '48%' } : { width: '100%' },
              active && styles.pillActive,
            ]}
          >
            {withIcon && opt.icon && (
              <View
                style={[
                  styles.pillIcon,
                  active && { backgroundColor: colors.primary },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={14}
                  color={active ? '#fff' : colors.primary}
                />
              </View>
            )}

            <Text
              style={[
                styles.pillText,
                active && styles.pillTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ───────────────────────────────────────────── */

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { checking } = useAuthGuard();

  const [step, setStep] = useState(0);

  const [form, setForm] = useState(INITIAL);

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [extendMode, setExtendMode] = useState(false);

  const set = (k) => (v) =>
    setForm((s) => ({
      ...s,
      [k]: v,
    }));

  /* ───────────────────────────────────────────── */

  const finalDisease =
    form.goal === 'disease'
      ? form.disease === 'Khác'
        ? form.custom_disease.trim()
        : form.disease
      : '';

  /* ───────────────────────────────────────────── */

  const onSelectGoal = (goal) => {
    setForm((s) => ({
      ...s,
      goal,

      disease: goal === 'disease' ? s.disease : '',
      custom_disease:
        goal === 'disease'
          ? s.custom_disease
          : '',
    }));
  };

  /* ───────────────────────────────────────────── */

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
            birth_year: p.birth_year
              ? String(p.birth_year)
              : '',

            height: p.height
              ? String(p.height)
              : '',

            weight: p.weight
              ? String(p.weight)
              : '',

            target_weight: p.target_weight
              ? String(p.target_weight)
              : '',

            deadline: p.deadline || '',

            speed: p.speed || s.speed,

            activity: p.activity_level
              ? String(p.activity_level)
              : s.activity,

            cheat_days: p.high_cal_days || '',

            snacking: p.snacking || s.snacking,

            allergies: p.allergies || '',

            focus_macro:
              p.focus_macro || s.focus_macro,

            reason: p.reason || '',

            goal: p.goal || '',
          }));

          /* deadline passed */

          if (p.deadline) {
            const deadlineDate = new Date(p.deadline);

            deadlineDate.setHours(
              23,
              59,
              59,
              999
            );

            const passed =
              new Date() > deadlineDate;

            setExtendMode(passed);
          }

          /* disease restore */

          if (p.goal === 'disease') {
            const predefined =
              DISEASES.includes(p.disease);

            if (predefined) {
              setForm((s) => ({
                ...s,
                disease: p.disease,
                custom_disease: '',
              }));
            } else {
              setForm((s) => ({
                ...s,
                disease: 'Khác',
                custom_disease:
                  p.disease || '',
              }));
            }
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [checking]);

  /* ───────────────────────────────────────────── */

  const validate = () => {
    if (step === 0) {
      if (
        !form.birth_year ||
        !form.height ||
        !form.weight
      ) {
        toast.show(
          'Vui lòng nhập đầy đủ chỉ số',
          'error'
        );

        return false;
      }
    }

    if (step === 1) {
      if (!form.goal) {
        toast.show(
          'Hãy chọn mục tiêu',
          'error'
        );

        return false;
      }

      if (
        form.goal === 'disease' &&
        !finalDisease
      ) {
        toast.show(
          'Vui lòng nhập bệnh lý',
          'error'
        );

        return false;
      }
    }

    return true;
  };

  /* ───────────────────────────────────────────── */

  const submit = async () => {
    setSaving(true);

    try {
      const payload = {
        ...form,

        goal: form.goal,

        disease:
          form.goal === 'disease'
            ? form.disease === 'Khác'
              ? form.custom_disease.trim()
              : form.disease
            : '',
      };

      delete payload.custom_disease;

      await SetupAPI.save(payload);

      toast.show('Hoàn tất!', 'success');

      navigation?.replace?.('DietDetails');
    } catch (e) {
      toast.show(
        e.message || 'Có lỗi xảy ra',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  /* ───────────────────────────────────────────── */

  const next = () => {
    if (!validate()) return;

    if (step < 3) {
      setStep(step + 1);
    } else {
      submit();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  /* ───────────────────────────────────────────── */

  const confirmLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc muốn đăng xuất?',
      [
        {
          text: 'Huỷ',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  /* ───────────────────────────────────────────── */

  if (checking || loadingData) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator
          color={colors.primary}
          size="large"
        />

        <Text
          style={{
            marginTop: 12,
            color: colors.textSub,
          }}
        >
          {checking
            ? 'Đang xác thực...'
            : 'Đang tải hồ sơ...'}
        </Text>
      </SafeAreaView>
    );
  }

  /* ───────────────────────────────────────────── */

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top']}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons
            name="leaf"
            size={20}
            color={colors.primary}
          />

          <Text style={styles.brand}>
            Calorie AI
          </Text>
        </View>

        <Pressable
          onPress={confirmLogout}
          style={styles.logoutBtn}
        >
          <Ionicons
            name="log-out-outline"
            size={16}
            color="#fff"
          />

          <Text style={styles.logoutText}>
            Đăng xuất
          </Text>
        </Pressable>
      </View>

      {/* BODY */}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 100,
          }}
        >
          {extendMode && (
            <View style={styles.extendBanner}>
              <Ionicons
                name="medal"
                size={18}
                color={colors.primaryDark}
              />

              <Text style={styles.extendText}>
                Chặng đường cũ đã hoàn
                thành. Hãy cập nhật cân
                nặng mới và đặt deadline
                mới nhé!
              </Text>
            </View>
          )}

          <Card>
            {/* USER */}

            <View style={styles.userBox}>
              <View style={styles.avatar}>
                <Ionicons
                  name="person"
                  size={22}
                  color="#fff"
                />
              </View>

              <View>
                <Text style={styles.userName}>
                  {extendMode
                    ? 'Bắt đầu lộ trình mới'
                    : 'Thiết lập lộ trình'}
                </Text>

                <Text style={styles.userId}>
                  ID: {user?.id || '—'}
                </Text>
              </View>
            </View>

            {/* PROGRESS */}

            <View style={styles.progress}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.progressStep,
                    i <= step &&
                      styles.progressStepActive,
                  ]}
                />
              ))}
            </View>

            {/* STEP 1 */}

            {step === 0 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>
                  Chỉ số cơ thể
                </Text>

                <Text style={styles.psub}>
                  Để tính toán BMR và
                  TDEE chính xác.
                </Text>

                <Text style={styles.label}>
                  Giới tính
                </Text>

                <PillGroup
                  options={GENDERS}
                  value={form.gender}
                  onChange={set('gender')}
                />

                <Field
                  label="Năm sinh"
                  value={form.birth_year}
                  onChangeText={set(
                    'birth_year'
                  )}
                  keyboardType="number-pad"
                  placeholder="2000"
                />

                <View
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Chiều cao (cm)"
                      value={form.height}
                      onChangeText={set(
                        'height'
                      )}
                      keyboardType="number-pad"
                      placeholder="170"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Field
                      label="Cân nặng (kg)"
                      value={form.weight}
                      onChangeText={set(
                        'weight'
                      )}
                      keyboardType="number-pad"
                      placeholder="65"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* STEP 2 */}

            {step === 1 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>
                  Mục tiêu của bạn
                </Text>

                <Text style={styles.psub}>
                  Bạn muốn đạt được điều
                  gì?
                </Text>

                <View
                  style={{ marginTop: 8 }}
                >
                  <PillGroup
                    options={GOALS}
                    value={form.goal}
                    onChange={
                      onSelectGoal
                    }
                    withIcon
                  />
                </View>

                {/* disease */}

                {form.goal ===
                  'disease' && (
                  <View
                    style={{
                      marginTop: 14,
                    }}
                  >
                    <Text
                      style={styles.label}
                    >
                      Bệnh / tình trạng
                      sức khỏe
                    </Text>

                   <View style={styles.selectWrap}>
  <View style={styles.pickerContainer}>
    <Picker
      selectedValue={form.disease}
      onValueChange={set('disease')}
      style={styles.picker}
      dropdownIconColor={colors.primary}
    >
      <Picker.Item
        label="-- Chọn bệnh --"
        value=""
      />

      {DISEASES.map((d) => (
        <Picker.Item
          key={d}
          label={d}
          value={d}
        />
      ))}
    </Picker>

    <Ionicons
      name="chevron-down"
      size={18}
      color={colors.primary}
      style={styles.pickerIcon}
    />
  </View>
</View>

                    {form.disease ===
                      'Khác' && (
                      <Field
                        label="Tên bệnh"
                        value={
                          form.custom_disease
                        }
                        onChangeText={set(
                          'custom_disease'
                        )}
                        placeholder="Nhập tên bệnh..."
                      />
                    )}
                  </View>
                )}

                <View
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Cân nặng mục tiêu"
                      value={
                        form.target_weight
                      }
                      onChangeText={set(
                        'target_weight'
                      )}
                      keyboardType="number-pad"
                      placeholder="60"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Field
                      label="Deadline"
                      value={form.deadline}
                      onChangeText={set(
                        'deadline'
                      )}
                      placeholder="2026-12-31"
                    />
                  </View>
                </View>

                <Text style={styles.label}>
                  Tốc độ mong muốn
                </Text>

                <PillGroup
                  options={SPEEDS}
                  value={form.speed}
                  onChange={set('speed')}
                  columns={1}
                />
              </View>
            )}

            {/* STEP 3 */}

            {step === 2 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>
                  Thói quen & Linh hoạt
                </Text>

                <Text style={styles.psub}>
                  Tối ưu hóa calo theo
                  lịch trình của bạn.
                </Text>

                <Text style={styles.label}>
                  Tần suất vận động
                </Text>

                <PillGroup
                  options={ACTIVITIES}
                  value={form.activity}
                  onChange={set(
                    'activity'
                  )}
                  columns={1}
                />

                <Field
                  label="Ngày ăn nhiều (Cheat day)"
                  value={form.cheat_days}
                  onChangeText={set(
                    'cheat_days'
                  )}
                  placeholder="Thứ 7 và Chủ Nhật"
                />

                <Text style={styles.label}>
                  Bạn có hay ăn vặt không?
                </Text>

                <PillGroup
                  options={SNACKS}
                  value={form.snacking}
                  onChange={set(
                    'snacking'
                  )}
                  columns={1}
                />
              </View>
            )}

            {/* STEP 4 */}

            {step === 3 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.h2}>
                  Cá nhân hóa sâu
                </Text>

                <Text style={styles.psub}>
                  Bước cuối cùng để hoàn
                  tất lộ trình.
                </Text>

                <Field
                  label="Dị ứng / Thực phẩm không ăn được"
                  value={form.allergies}
                  onChangeText={set(
                    'allergies'
                  )}
                  placeholder="Không ăn hành, dị ứng hải sản..."
                  multiline
                />

                <Text style={styles.label}>
                  Tập trung vào chất nào?
                </Text>

                <PillGroup
                  options={FOCUS}
                  value={form.focus_macro}
                  onChange={set(
                    'focus_macro'
                  )}
                  columns={1}
                />

                <Field
                  label="Lý do bắt đầu"
                  value={form.reason}
                  onChangeText={set(
                    'reason'
                  )}
                  placeholder="Cải thiện sức khỏe..."
                />
              </View>
            )}

            {/* BUTTONS */}

            <View style={styles.btnRow}>
              {step > 0 ? (
                <Button
                  title="Quay lại"
                  variant="ghost"
                  onPress={prev}
                />
              ) : (
                <View />
              )}

              <Button
                title={
                  step === 3
                    ? 'Hoàn tất lộ trình'
                    : 'Tiếp tục'
                }
                onPress={next}
                loading={saving}
                icon={
                  <Ionicons
                    name={
                      step === 3
                        ? 'checkmark'
                        : 'arrow-forward'
                    }
                    size={16}
                    color="#fff"
                  />
                }
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ───────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    paddingHorizontal: 16,
    paddingVertical: 12,

    backgroundColor: '#fff',

    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  brand: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,

    backgroundColor: '#dc2626',

    paddingHorizontal: 12,
    paddingVertical: 8,

    borderRadius: 10,
  },

  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  extendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,

    backgroundColor: colors.primarySoft,

    padding: 16,

    borderRadius: 16,

    marginBottom: 16,

    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },

  extendText: {
    flex: 1,

    fontSize: 13,
    fontWeight: '600',

    color: colors.primaryDark,
  },

  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,

    marginBottom: 16,

    paddingBottom: 14,

    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f1',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,

    backgroundColor: colors.primary,

    alignItems: 'center',
    justifyContent: 'center',
  },

  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
  },

  userId: {
    fontSize: 12,
    color: colors.textSub,
    marginTop: 2,
  },

  progress: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },

  progressStep: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#eee',
  },

  progressStepActive: {
    backgroundColor: colors.primary,
  },

  h2: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textMain,
  },

  psub: {
    color: colors.textSub,
    fontSize: 13,
    marginBottom: 14,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',

    marginTop: 12,
    marginBottom: 8,
  },

  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,

    paddingVertical: 12,
    paddingHorizontal: 14,

    borderRadius: radius.lg,

    borderWidth: 1.5,
    borderColor: '#e5e7e5',

    backgroundColor: '#fafbfa',
  },

  pillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },

  pillIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,

    backgroundColor: '#fff',

    alignItems: 'center',
    justifyContent: 'center',
  },

  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMain,
    flex: 1,
  },

  pillTextActive: {
    color: colors.primaryDark,
  },
selectWrap: {
  marginTop: 8,

  backgroundColor: '#fff',

  borderRadius: 18,

  borderWidth: 1.5,
  borderColor: '#dfe7df',

  overflow: 'hidden',

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 4,
  },
  shadowOpacity: 0.06,
  shadowRadius: 10,

  elevation: 3,
},
picker: {
  color: colors.textMain,
},

pickerContainer: {
  position: 'relative',
  justifyContent: 'center',
},

pickerIcon: {
  position: 'absolute',
  right: 14,
  zIndex: 10,
},
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginTop: 24,

    gap: 12,
  },
});