// src/screens/SettingsScreen.js
// Hồ sơ → Cài đặt → Xoá tài khoản.
//
// Đường dẫn này khớp từng chữ với hướng dẫn công khai ở /delete-account (URL nộp
// cho Google Play) và với bản web. Lệch một bước là hồ sơ bị từ chối.
//
// Ba lớp chặn bấm nhầm, đúng như bản web:
//   1. hộp thoại xác nhận của hệ điều hành, nút Xoá kiểu destructive;
//   2. gõ đúng từ khoá — nút không bật cho tới lúc đó;
//   3. khoá nút khi đang gửi để không tạo hai yêu cầu.
import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, StyleSheet,
} from 'react-native';
// SafeAreaView của react-native KHÔNG có tác dụng trên Android (chỉ iOS) — mà app
// bật edge-to-edge nên header sẽ chui lên dưới thanh trạng thái. Dùng bản của
// safe-area-context để tôn trọng insets ở cả hai nền tảng.
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { confirm2 } from '../utils/confirm';
import { isOfflineError } from '../api/client';
import { colors, spacing, radius, font, shadow } from '../theme/colors';

/** Từ khoá xác nhận — cùng chữ với bản web. */
const CONFIRM_WORD = 'XOA';

const DELETED_ITEMS = [
  ['person-outline', 'set.d_profile', 'Hồ sơ cá nhân'],
  ['nutrition-outline', 'set.d_nutrition', 'Thông tin dinh dưỡng'],
  ['restaurant-outline', 'set.d_meals', 'Lịch sử bữa ăn và thực đơn'],
  ['image-outline', 'set.d_photos', 'Ảnh món ăn đã tải lên'],
  ['chatbubbles-outline', 'set.d_chat', 'Lịch sử trò chuyện với AI'],
  ['people-outline', 'set.d_family', 'Liên kết gia đình'],
  ['options-outline', 'set.d_prefs', 'Tuỳ chọn cá nhân'],
];

export default function SettingsScreen({ navigation }) {
  const { deleteAccount, finishDeletion } = useAuth();
  const { t } = useI18n();

  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [offline, setOffline] = useState(false);
  const [done, setDone] = useState(false);

  const canDelete = word.trim().toUpperCase() === CONFIRM_WORD && !busy;

  async function runDeletion() {
    setBusy(true);
    setErr(null);
    setOffline(false);
    try {
      await deleteAccount();
      setDone(true);
    } catch (e) {
      // Mất mạng là tình huống người dùng tự khắc phục được — tách hẳn khỏi
      // lỗi máy chủ để không khuyên họ "thử lại sau" một cách vô nghĩa.
      if (isOfflineError(e)) {
        setOffline(true);
        setErr(t('set.err_offline', 'Không có kết nối mạng. Hãy kết nối lại rồi thử lần nữa — tài khoản của bạn chưa bị thay đổi.'));
      } else {
        setErr(e?.message || t('set.err_generic', 'Không xoá được tài khoản. Vui lòng thử lại.'));
      }
      setBusy(false);
    }
  }

  function askDelete() {
    if (!canDelete) return;
    confirm2(
      t('set.delete_title', 'Xoá tài khoản'),
      t('set.confirm_body',
        'Xoá tài khoản là vĩnh viễn. Hồ sơ, thông tin dinh dưỡng, lịch sử bữa ăn, ảnh món ăn, '
        + 'lịch sử trò chuyện với AI và tuỳ chọn cá nhân của bạn sẽ bị xoá.\n\nHành động này không thể hoàn tác.'),
      {
        cancelText: t('m.cancel', 'Huỷ'),
        confirmText: t('set.delete_btn', 'Xoá tài khoản'),
        destructive: true,
        onConfirm: runDeletion,
      }
    );
  }

  /* ── màn thành công ─────────────────────────────────────────────────── */
  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
          </View>
          <Text style={styles.doneTitle}>{t('set.done_title', 'Đã xoá tài khoản')}</Text>
          <Text style={styles.doneBody}>
            {t('set.done_body',
              'Tài khoản và toàn bộ dữ liệu của bạn đã được xoá vĩnh viễn. Cảm ơn bạn đã sử dụng Dr.Fit.')}
          </Text>
          <Pressable style={styles.donePrimary} onPress={finishDeletion}>
            <Text style={styles.donePrimaryText}>{t('set.done_btn', 'Về trang đăng nhập')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ── cài đặt ────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityLabel={t('m.back', 'Quay lại')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('set.title', 'Cài đặt')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('set.account', 'Tài khoản')}</Text>
          <Pressable style={styles.row} onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}>
            <Ionicons name="person-outline" size={19} color={colors.textSub} />
            <Text style={styles.rowText}>{t('set.edit_profile', 'Chỉnh sửa hồ sơ')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Vùng nguy hiểm — khung đỏ riêng, tách hẳn khỏi cài đặt thường. */}
        <View style={styles.danger}>
          <View style={styles.dangerHead}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.dangerHeadText}>{t('set.danger', 'Vùng nguy hiểm')}</Text>
          </View>

          <View style={styles.dangerBody}>
            <Text style={styles.dangerTitle}>{t('set.delete_title', 'Xoá tài khoản')}</Text>
            <Text style={styles.dangerDesc}>
              {t('set.delete_lead', 'Xoá tài khoản là vĩnh viễn. Những dữ liệu sau sẽ bị xoá:')}
            </Text>

            <View style={styles.list}>
              {DELETED_ITEMS.map(([icon, key, fallback]) => (
                <View style={styles.listItem} key={key}>
                  <Ionicons name={icon} size={15} color={colors.textSub} style={styles.listIcon} />
                  <Text style={styles.listText}>{t(key, fallback)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.warnBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.warnText}>
                {t('set.delete_irreversible', 'Hành động này không thể hoàn tác.')}
              </Text>
            </View>

            <Text style={styles.confirmLabel}>
              {t('set.type_to_confirm', 'Nhập')}{' '}
              <Text style={styles.confirmWord}>{CONFIRM_WORD}</Text>{' '}
              {t('set.type_to_confirm2', 'để xác nhận')}
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={word}
              onChangeText={setWord}
              editable={!busy}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
            />

            {err ? (
              <View style={[styles.errBox, offline && styles.errBoxOffline]}>
                <Ionicons
                  name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
                  size={16}
                  color={offline ? colors.warning : colors.danger}
                />
                <Text style={[styles.errText, offline && styles.errTextOffline]}>{err}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.deleteBtn, !canDelete && styles.deleteBtnOff]}
              onPress={askDelete}
              disabled={!canDelete}
            >
              {busy ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.deleteBtnText}>{t('set.deleting', 'Đang xoá...')}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="trash-outline" size={17} color="#fff" />
                  <Text style={styles.deleteBtnText}>{t('set.delete_btn', 'Xoá tài khoản')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        <Text style={styles.foot}>
          {t('set.delete_more_m', 'Việc xoá tài khoản thường hoàn tất ngay. Bản sao lưu lưu trữ có thể mất tới 30 ngày để hết hạn.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.textMain },

  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  cardTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.heavy,
    color: colors.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowText: { flex: 1, fontSize: font.size.lg, color: colors.textMain, fontWeight: font.weight.medium },

  danger: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(229,72,77,0.35)',
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  dangerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229,72,77,0.2)',
  },
  dangerHeadText: { fontSize: font.size.md, fontWeight: font.weight.heavy, color: colors.danger },

  dangerBody: { padding: spacing.lg, gap: spacing.md },
  dangerTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.textMain },
  dangerDesc: { fontSize: font.size.md, lineHeight: 21, color: colors.textSub },

  list: { gap: spacing.sm },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listIcon: { width: 20, textAlign: 'center' },
  listText: { flex: 1, fontSize: font.size.md, color: colors.textMain },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  warnText: { flex: 1, fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.danger },

  confirmLabel: { fontSize: font.size.sm, color: colors.textSub, marginTop: spacing.xs },
  confirmWord: { fontWeight: font.weight.heavy, color: colors.danger, letterSpacing: 1 },
  confirmInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    letterSpacing: 3,
    textAlign: 'center',
    color: colors.textMain,
    backgroundColor: colors.surface,
  },

  errBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  errBoxOffline: { backgroundColor: colors.warningSoft },
  errText: { flex: 1, fontSize: font.size.sm, lineHeight: 19, color: colors.danger },
  errTextOffline: { color: '#8A5A00' },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
    marginTop: spacing.xs,
  },
  deleteBtnOff: { opacity: 0.45 },
  deleteBtnText: { color: '#fff', fontSize: font.size.lg, fontWeight: font.weight.bold },

  foot: {
    marginTop: spacing.lg,
    fontSize: font.size.sm,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
  },

  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    gap: spacing.lg,
  },
  doneIcon: {
    width: 96, height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  doneTitle: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.primaryDark, textAlign: 'center' },
  doneBody: { fontSize: font.size.lg, lineHeight: 25, color: colors.textSub, textAlign: 'center' },
  donePrimary: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  donePrimaryText: { color: '#fff', fontSize: font.size.lg, fontWeight: font.weight.bold },
});
