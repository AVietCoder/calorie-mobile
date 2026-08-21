import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, FlatList, ImageBackground, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, Card, Field, SectionTitle } from '../../components/UI';
import { FamilyMenuAPI } from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, font, radius, shadow, spacing } from '../../theme/colors';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useI18n } from '../../i18n';
import { MENU_CATEGORIES, getCategory } from '../../menu/categories';
import { sourceLogo } from '../../menu/sourceLogos';

/**
 * Bỏ dấu để tìm kiếm khớp cả khi gõ không dấu.
 *
 * Người dùng điện thoại rất hay gõ "tieu duong" thay vì "tiểu đường"; so khớp
 * chuỗi thô sẽ không ra kết quả nào và trông như thư viện rỗng.
 */
const deaccent = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

/* ══════════════════════════════════════════════════════════════════════════
   Màn tạo hộ — hàng rào bắt buộc.

   Mọi resource thực đơn của API đều đòi household và trả thẳng 400 nếu chưa
   có. Thay vì để người dùng đâm vào lỗi đó, hiện luôn form tạo ở đây. Chỉ hỏi
   những trường THỰC SỰ cần để vượt rào; thành viên chi tiết để dành cho màn
   Hồ sơ gia đình, vì bắt khai cả nhà ngay lần đầu là cách nhanh nhất khiến
   người ta bỏ đi.
   ══════════════════════════════════════════════════════════════════════════ */
function HouseholdSetup({ onCreated, t }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [mode, setMode] = useState('family');
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    try {
      await FamilyMenuAPI.createHousehold({
        mode,
        owner_display_name: name.trim() || 'Chủ hộ',
        meals_per_day: 3,
      });
      toast.show(t('fm.created', 'Đã tạo hồ sơ gia đình.'), 'success');
      onCreated();
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <SectionTitle sub={t('fm.setup_sub', 'Thực đơn được chọn theo tình trạng sức khoẻ của cả nhà, nên cần một hồ sơ trước.')}>
        {t('fm.setup_title', 'Tạo hồ sơ gia đình')}
      </SectionTitle>

      <Card>
        <Field
          label={t('fm.your_name', 'Tên bạn')}
          placeholder={t('fm.your_name_ph', 'Ví dụ: Mẹ Lan')}
          value={name}
          onChangeText={setName}
          hint={t('fm.your_name_hint', 'Để trống sẽ ghi là "Chủ hộ".')}
        />

        <Text style={styles.label}>{t('fm.mode', 'Bạn nấu cho ai?')}</Text>
        <View style={styles.modeRow}>
          {[
            { id: 'family', icon: 'people', label: t('fm.mode_family', 'Gia đình') },
            { id: 'chef', icon: 'business', label: t('fm.mode_org', 'Tổ chức') },
          ].map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setMode(m.id)}
              style={[styles.modeCard, mode === m.id && styles.modeCardActive]}
            >
              <Ionicons
                name={m.icon}
                size={22}
                color={mode === m.id ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.modeText, mode === m.id && styles.modeTextActive]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        <Button
          title={t('fm.create', 'Tạo và xem thực đơn')}
          onPress={create}
          loading={saving}
          fullWidth
          style={{ marginTop: spacing.lg }}
        />
      </Card>
    </ScrollView>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Thẻ thực đơn
   ══════════════════════════════════════════════════════════════════════════ */
function TemplateCard({ item, onPress, t }) {
  const tpl = item.template;
  const cat = getCategory(tpl.category);
  const logo = tpl.image_url ? null : sourceLogo(tpl.source_name);
  /* Ảnh nền bìa: ảnh admin tải lên trước, không có thì logo đơn vị. */
  const cover = tpl.image_url || logo;

  return (
    <Pressable
      onPress={() => onPress(tpl.id)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      {/* Bìa: ẢNH phủ kín, huy hiệu đè lên — dựng đúng như bản web
          (.ml-cover-bg): cover + center + phóng nhẹ 1.3× cho logo, rồi một lớp
          gradient tối để hai huy hiệu đọc được trên mọi màu logo.
          Gradient danh mục nằm dưới cùng làm nền dự phòng khi nguồn chưa có
          logo hoặc ảnh lỗi mạng. */}
      <View style={styles.cover}>
        <LinearGradient colors={[cat.from, cat.to]} style={StyleSheet.absoluteFill} />

        {cover ? (
          <ImageBackground
            source={{ uri: cover }}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            imageStyle={tpl.image_url ? null : styles.coverLogoImg}
          />
        ) : (
          <View style={styles.coverIcon}>
            <Ionicons name={cat.icon} size={34} color="rgba(255,255,255,0.92)" />
          </View>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.34)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.32)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.coverTop}>
          {tpl.is_system && (
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={11} color={colors.primaryDark} />
              <Text style={styles.badgeText}>{t('ml.system', 'Hệ thống')}</Text>
            </View>
          )}
          <View style={styles.catChip}>
            <Text style={styles.catChipText}>{cat.label}</Text>
          </View>
        </View>

        {item.in_use && (
          <View style={styles.inUse}>
            <Ionicons name="checkmark-circle" size={12} color="#fff" />
            <Text style={styles.inUseText}>{t('ml.in_use', 'Đang dùng')}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{tpl.title}</Text>
        {!!tpl.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>{tpl.description}</Text>
        )}
      </View>
    </Pressable>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function MenuLibraryScreen({ navigation }) {
  const { checking } = useAuthGuard();
  const { t } = useI18n();
  const toast = useToast();

  const [household, setHousehold] = useState(undefined); // undefined = chưa biết
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState(null);
  const [query, setQuery] = useState('');
  /** Kế hoạch đang chạy của hộ — API trả kèm trong response templates. */
  const [activePlanId, setActivePlanId] = useState(null);

  /* `toast` CỐ Ý không nằm trong mảng phụ thuộc của load.
     ToastContext truyền value={{ show }} — object MỚI mỗi lần provider render,
     nên thêm nó vào deps sẽ biến useFocusEffect thành vòng lặp: lỗi → hiện
     toast → provider render → load đổi định danh → gọi lại → lỗi… Bắt qua
     closure là an toàn vì `show` đã được useCallback giữ nguyên định danh. */
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const hh = await FamilyMenuAPI.household();
      setHousehold(hh?.household || null);
      // Chưa có hộ thì gọi tiếp cũng chỉ nhận 400 — dừng ở đây, form tạo sẽ hiện.
      if (!hh?.household) { setItems([]); return; }

      const data = await FamilyMenuAPI.templates();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setActivePlanId(data?.active_plan_id || null);
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load({ silent: true }); }, [load]));

  /** Lọc theo danh mục + từ khoá. Lọc ở client vì cả danh sách chỉ ~40 mục. */
  const shown = useMemo(() => {
    const q = deaccent(query);
    return items.filter((it) => {
      const tpl = it.template;
      if (cat && tpl.category !== cat) return false;
      if (!q) return true;
      return deaccent(`${tpl.title} ${tpl.description} ${tpl.source_name}`).includes(q);
    });
  }, [items, cat, query]);

  /** Chỉ hiện chip của danh mục THỰC SỰ có thực đơn — chip rỗng bấm vào ra
      danh sách trắng, người dùng tưởng hỏng. */
  const cats = useMemo(() => {
    const present = new Set(items.map((i) => i.template.category));
    return MENU_CATEGORIES.filter((c) => present.has(c.id));
  }, [items]);

  if (checking || household === undefined) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!household) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Cũng cần lối ra: ai chưa muốn tạo hộ mà không có nút quay lại thì
            coi như bị nhốt ở form này. */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.85 }]}
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.backLinkText}>{t('ml.back_personal', 'Thực đơn cá nhân')}</Text>
        </Pressable>
        <HouseholdSetup onCreated={() => load()} t={t} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Lối QUAY VỀ thực đơn cá nhân.
          Màn này nằm trong stack của tab Kế hoạch nên cử chỉ vuốt vẫn quay lại
          được, nhưng không có gì trên màn hình nói điều đó — người dùng vào rồi
          tưởng mắc kẹt trong mảng gia đình. */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.85 }]}
        hitSlop={6}
      >
        <Ionicons name="chevron-back" size={16} color={colors.primary} />
        <Text style={styles.backLinkText}>{t('ml.back_personal', 'Thực đơn cá nhân')}</Text>
      </Pressable>

      <View style={styles.header}>
        <SectionTitle sub={t('ml.sub', 'Thực đơn 7 ngày từ bệnh viện, nhà thuốc và trung tâm dinh dưỡng')} style={{ flex: 1, marginBottom: 0 }}>
          {t('ml.title', 'Thư viện thực đơn')}
        </SectionTitle>
        <Pressable onPress={() => navigation.navigate('Household')} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="people-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Lối vào kế hoạch đang chạy. Không có nó thì sau khi áp dụng xong,
          người dùng chỉ quay lại được kế hoạch bằng cách mở đúng thực đơn cũ. */}
      {activePlanId && (
        <Pressable
          onPress={() => navigation.navigate('MenuPlan', { householdId: household.id })}
          style={({ pressed }) => [styles.activeBanner, pressed && { opacity: 0.92 }]}
        >
          <Ionicons name="calendar" size={17} color={colors.primaryDark} />
          <Text style={styles.activeText}>
            {t('ml.open_plan', 'Xem kế hoạch đang dùng')}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.primary} />
        </Pressable>
      )}

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('ml.search', 'Tìm theo tên hoặc nguồn…')}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            onPress={() => setCat(null)}
            style={[styles.chip, !cat && styles.chipActive]}
          >
            <Text style={[styles.chipText, !cat && styles.chipTextActive]}>
              {t('ml.all', 'Tất cả')}
            </Text>
          </Pressable>
          {cats.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCat(cat === c.id ? null : c.id)}
              style={[styles.chip, cat === c.id && styles.chipActive]}
            >
              <Ionicons
                name={c.icon}
                size={13}
                color={cat === c.id ? '#fff' : colors.textSub}
              />
              <Text style={[styles.chipText, cat === c.id && styles.chipTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(it) => it.template.id}
          renderItem={({ item }) => (
            <TemplateCard
              item={item}
              t={t}
              onPress={(id) => navigation.navigate('TemplateDetail', { id, householdId: household.id })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load({ silent: true }); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query || cat
                ? t('ml.no_match', 'Không có thực đơn nào khớp. Thử xoá từ khoá hoặc chọn "Tất cả".')
                : t('ml.empty', 'Thư viện chưa có thực đơn nào.')}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },

  backLink: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    alignSelf: 'flex-start',
    marginLeft: spacing.lg - 4, marginTop: spacing.sm,
    paddingVertical: 6, paddingHorizontal: 4,
  },
  backLinkText: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.primary },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },

  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    paddingHorizontal: spacing.lg, height: 46,
    borderRadius: radius.md, backgroundColor: colors.primarySoft,
  },
  activeText: { flex: 1, fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.primaryDark },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    paddingHorizontal: spacing.md, height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: font.size.md, color: colors.textMain, padding: 0 },

  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, height: 34, borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.size.sm, color: colors.textSub, fontWeight: font.weight.semibold },
  chipTextActive: { color: '#fff' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge, gap: spacing.md },

  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  cover: { height: 124, overflow: 'hidden' },
  /* Phóng 1.3× cho LOGO — y như .ml-cover-bg.is-logo bên web: logo phần lớn là
     ảnh vuông, phủ cover lên bìa ngang mà để nguyên thì mép trắng của logo lộ
     thành viền lạ. Ảnh admin tải lên là ảnh thật nên giữ nguyên. */
  coverLogoImg: { transform: [{ scale: 1.3 }] },
  coverIcon: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  coverTop: {
    position: 'absolute', top: 10, left: 10, right: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, height: 22, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  badgeText: { fontSize: 10.5, fontWeight: font.weight.bold, color: colors.primaryDark },
  catChip: {
    paddingHorizontal: 9, height: 22, borderRadius: radius.full,
    justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  catChipText: { fontSize: 10.5, fontWeight: font.weight.bold, color: '#fff' },
  inUse: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, height: 22, borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  inUseText: { fontSize: 10.5, fontWeight: font.weight.bold, color: '#fff' },

  cardBody: { padding: spacing.lg, gap: 5 },
  cardTitle: {
    fontSize: font.size.lg, fontWeight: font.weight.bold,
    color: colors.textMain, lineHeight: font.size.lg * 1.35,
  },
  cardDesc: { fontSize: font.size.sm, color: colors.textSub, lineHeight: font.size.sm * 1.45 },

  empty: { textAlign: 'center', color: colors.textSub, paddingVertical: spacing.huge, paddingHorizontal: spacing.lg },

  label: {
    fontSize: font.size.sm, fontWeight: font.weight.semibold,
    color: colors.textSub, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  modeRow: { flexDirection: 'row', gap: spacing.md },
  modeCard: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  modeCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  modeText: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textSub },
  modeTextActive: { color: colors.primaryDark },
});
