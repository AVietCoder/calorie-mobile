import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, Field } from '../../components/UI';
import { FamilyMenuAPI } from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, font, radius, spacing } from '../../theme/colors';
import { useI18n } from '../../i18n';
import { confirmAction } from '../../utils/confirm';

/** Nhãn của các mục chọn — giữ nguyên GIÁ TRỊ mà API/web đang dùng. */
const GOALS = [
  { id: 'maintain', label: 'Giữ cân' },
  { id: 'lose', label: 'Giảm cân' },
  { id: 'gain', label: 'Tăng cân' },
];

const emptyForm = {
  display_name: '', relation: '', birth_year: '', gender: '',
  height: '', weight: '', goal: '', disease: '',
};

export default function HouseholdScreen({ navigation }) {
  const { t } = useI18n();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState(null);   // null = form đóng
  const [saving, setSaving] = useState(false);

  /* `toast` CỐ Ý không nằm trong mảng phụ thuộc của load.
     ToastContext truyền value={{ show }} — object MỚI mỗi lần provider render,
     nên thêm nó vào deps sẽ biến useFocusEffect thành vòng lặp: lỗi → hiện
     toast → provider render → load đổi định danh → gọi lại → lỗi… Bắt qua
     closure là an toàn vì `show` đã được useCallback giữ nguyên định danh. */
  const load = useCallback(async () => {
    try {
      setData(await FamilyMenuAPI.household());
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.display_name.trim()) {
      toast.show(t('fm.need_name', 'Hãy nhập tên thành viên.'), 'error');
      return;
    }
    setSaving(true);
    try {
      /* Gửi chuỗi RỖNG cho trường số sẽ làm Postgres nổ
         "invalid input syntax for type numeric" — server đã có numericOrNull
         nhận '' → null, nhưng lọc sẵn ở đây thì payload cũng sạch hơn. */
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        const s = typeof v === 'string' ? v.trim() : v;
        if (s !== '' && s != null) payload[k] = s;
      }

      if (form.id) await FamilyMenuAPI.updateMember(form.id, payload);
      else await FamilyMenuAPI.addMember(data.household.id, payload);

      toast.show(t('fm.saved', 'Đã lưu thành viên.'), 'success');
      setForm(null);
      load();
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(m) {
    const okToGo = await confirmAction({
      title: t('fm.remove_title', 'Xoá thành viên?'),
      message: `${m.display_name}`,
      confirmText: t('fm.remove_yes', 'Xoá'),
      destructive: true,
    });
    if (!okToGo) return;
    try {
      await FamilyMenuAPI.removeMember(m.id);
      toast.show(t('fm.removed', 'Đã xoá thành viên.'), 'success');
      load();
    } catch (e) {
      toast.show(e.message, 'error');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const hh = data?.household;
  const members = data?.members || [];
  const isOwner = !!data?.is_owner;

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
            <Text style={styles.title}>{t('fm.title', 'Hồ sơ gia đình')}</Text>
            <Text style={styles.sub}>
              {t('fm.sub', 'Thực đơn được gợi ý theo tình trạng sức khoẻ của từng người.')}
            </Text>
          </View>
        </View>

        {/* Mã tham gia chỉ chủ hộ mới thấy — thành viên không được xem mã. */}
        {isOwner && hh?.join_code && (
          <Card style={styles.codeCard}>
            <Text style={styles.codeLabel}>{t('fm.join_code', 'Mã tham gia gia đình')}</Text>
            <Text style={styles.code}>{hh.join_code}</Text>
            <Text style={styles.codeHint}>
              {t('fm.join_hint', 'Người thân nhập mã này để xin vào gia đình. Bạn sẽ duyệt trước khi họ tham gia.')}
            </Text>
          </Card>
        )}

        <Text style={styles.section}>
          {t('fm.members', 'Thành viên')} ({members.length})
        </Text>

        {members.map((m) => (
          <Card key={m.id} style={styles.member}>
            <View style={styles.memberHead}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={16} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.display_name}</Text>
                <Text style={styles.memberMeta}>
                  {[
                    m.relation,
                    m.birth_year ? `${new Date().getFullYear() - m.birth_year} tuổi` : null,
                    m.weight ? `${m.weight} kg` : null,
                    m.disease,
                  ].filter(Boolean).join(' · ') || t('fm.no_info', 'Chưa có thông tin')}
                </Text>
              </View>

              {/* Chỉ chủ hộ mới sửa/xoá được; tài khoản đã liên kết (kind =
                  'linked') là chính chủ hộ nên không cho tự xoá mình. */}
              {isOwner && (
                <View style={styles.memberActions}>
                  <Pressable onPress={() => setForm({ ...emptyForm, ...m, birth_year: String(m.birth_year ?? ''), height: String(m.height ?? ''), weight: String(m.weight ?? '') })} hitSlop={8}>
                    <Ionicons name="create-outline" size={19} color={colors.primary} />
                  </Pressable>
                  {m.kind !== 'linked' && (
                    <Pressable onPress={() => remove(m)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </Card>
        ))}

        {isOwner && !form && (
          <Button
            title={t('fm.add_member', 'Thêm thành viên')}
            variant="secondary"
            fullWidth
            onPress={() => setForm({ ...emptyForm })}
            icon={<Ionicons name="add" size={17} color={colors.primary} style={{ marginRight: 6 }} />}
          />
        )}

        {form && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.formTitle}>
              {form.id ? t('fm.edit_member', 'Sửa thành viên') : t('fm.new_member', 'Thành viên mới')}
            </Text>

            <Field
              label={t('fm.name', 'Tên')}
              value={form.display_name}
              onChangeText={set('display_name')}
              placeholder={t('fm.name_ph', 'Ví dụ: Bà Hoa')}
            />
            <Field
              label={t('fm.relation', 'Quan hệ')}
              value={form.relation}
              onChangeText={set('relation')}
              placeholder={t('fm.relation_ph', 'Mẹ, con, ông…')}
            />
            <View style={styles.row2}>
              <Field
                label={t('fm.birth_year', 'Năm sinh')}
                value={form.birth_year}
                onChangeText={set('birth_year')}
                keyboardType="number-pad"
                style={{ flex: 1 }}
              />
              <Field
                label={t('fm.weight', 'Cân nặng (kg)')}
                value={form.weight}
                onChangeText={set('weight')}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
            </View>
            <Field
              label={t('fm.height', 'Chiều cao (cm)')}
              value={form.height}
              onChangeText={set('height')}
              keyboardType="numeric"
            />
            <Field
              label={t('fm.disease', 'Bệnh nền')}
              value={form.disease}
              onChangeText={set('disease')}
              placeholder={t('fm.disease_ph', 'Tiểu đường, gout, cao huyết áp…')}
              hint={t('fm.disease_hint', 'Dùng để gợi ý thực đơn phù hợp.')}
            />

            <Text style={styles.label}>{t('fm.goal', 'Mục tiêu')}</Text>
            <View style={styles.goalRow}>
              {GOALS.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => set('goal')(form.goal === g.id ? '' : g.id)}
                  style={[styles.goal, form.goal === g.id && styles.goalActive]}
                >
                  <Text style={[styles.goalText, form.goal === g.id && styles.goalTextActive]}>
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.formActions}>
              <Button
                title={t('common.cancel', 'Huỷ')}
                variant="ghost"
                onPress={() => setForm(null)}
                style={{ flex: 1 }}
              />
              <Button
                title={t('common.save', 'Lưu')}
                onPress={save}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  back: {
    width: 34, height: 34, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  title: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.textMain },
  sub: { fontSize: font.size.sm, color: colors.textSub, marginTop: 2, lineHeight: font.size.sm * 1.45 },

  codeCard: { alignItems: 'center', gap: 4, marginBottom: spacing.lg },
  codeLabel: { fontSize: font.size.xs, color: colors.textSub, fontWeight: font.weight.semibold },
  code: {
    fontSize: font.size.xxxl, fontWeight: font.weight.heavy,
    color: colors.primaryDark, letterSpacing: 6,
  },
  codeHint: { fontSize: font.size.xs, color: colors.textMuted, textAlign: 'center', lineHeight: font.size.xs * 1.5 },

  section: {
    fontSize: font.size.xs, fontWeight: font.weight.heavy, color: colors.textSub,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm,
  },

  member: { marginBottom: spacing.sm },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft,
  },
  memberName: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.textMain },
  memberMeta: { fontSize: font.size.xs, color: colors.textSub, marginTop: 2 },
  memberActions: { flexDirection: 'row', gap: spacing.lg },

  formTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.textMain, marginBottom: spacing.md },
  row2: { flexDirection: 'row', gap: spacing.md },
  label: {
    fontSize: font.size.sm, fontWeight: font.weight.semibold,
    color: colors.textSub, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  goalRow: { flexDirection: 'row', gap: spacing.sm },
  goal: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  goalActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  goalText: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textSub },
  goalTextActive: { color: colors.primaryDark },

  formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
