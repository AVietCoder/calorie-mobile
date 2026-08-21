import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FamilyMenuAPI } from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, font, radius, spacing } from '../../theme/colors';
import { useI18n } from '../../i18n';

/**
 * Màu + icon cho từng nhóm nguyên liệu.
 *
 * Khoá lấy đúng từ knowledge/ingredient-catalog.json (trường `category`), nên
 * server thêm nhóm mới mà app chưa cập nhật thì rơi về "khac" chứ không vỡ.
 * Danh sách đi chợ trước đây trắng đen từ trên xuống — dài mấy chục dòng thì
 * mắt không bám được vào đâu; màu theo nhóm giúp nhận ra khu vực trong chợ.
 */
const SHOP_CATS = {
  rau: { icon: 'leaf', color: '#4caf7d' },
  trai_cay: { icon: 'nutrition', color: '#f5a623' },
  thit: { icon: 'restaurant', color: '#e8634a' },
  hai_san: { icon: 'fish', color: '#3aa8c1' },
  trung_sua: { icon: 'egg', color: '#c9a227' },
  tinh_bot: { icon: 'pizza', color: '#7dc976' },
  do_kho: { icon: 'basket', color: '#a1795a' },
  gia_vi: { icon: 'flask', color: '#c4844a' },
  khac: { icon: 'ellipsis-horizontal', color: '#8d99ae' },
};
const catOf = (key) => SHOP_CATS[key] || SHOP_CATS.khac;

const money = (v) =>
  (v == null || !Number.isFinite(Number(v)) ? '—' : Math.round(v).toLocaleString('vi-VN'));
const qtyText = (v) =>
  (v == null || !Number.isFinite(Number(v)) ? '' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }));

/**
 * Danh sách đi chợ.
 *
 * Dùng cho HAI nguồn: kế hoạch đang chạy (`planId`) và xem trước một thực đơn
 * chưa áp dụng (`templateId`). Hai endpoint khác nhau nhưng TRẢ CÙNG một hình
 * dạng { items, groups, totals }, nên phần hiển thị dùng chung.
 */
export default function ShoppingListScreen({ route, navigation }) {
  const { planId, templateId, title } = route.params || {};
  const { t } = useI18n();
  const toast = useToast();

  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Đã mua — lưu trên máy, KHÔNG gửi lên server (web cũng lưu ở trình duyệt). */
  const [bought, setBought] = useState({});

  const scope = planId ? `plan:${planId}` : `tpl:${templateId}`;
  const storeKey = `menu_shopping_ticks_${scope}`;

  /* `toast` CỐ Ý không nằm trong mảng phụ thuộc của load.
     ToastContext truyền value={{ show }} — object MỚI mỗi lần provider render,
     nên thêm nó vào deps sẽ biến useFocusEffect thành vòng lặp: lỗi → hiện
     toast → provider render → load đổi định danh → gọi lại → lỗi… Bắt qua
     closure là an toàn vì `show` đã được useCallback giữ nguyên định danh. */
  const load = useCallback(async () => {
    try {
      const data = planId
        ? await FamilyMenuAPI.shoppingList(planId)
        : await FamilyMenuAPI.templateShoppingList(templateId);
      setModel(data);
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [planId, templateId]);

  const loadTicks = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storeKey);
      setBought(raw ? JSON.parse(raw) : {});
    } catch { setBought({}); }
  }, [storeKey]);

  React.useEffect(() => { load(); loadTicks(); }, [load, loadTicks]);

  async function toggle(id) {
    const next = { ...bought, [id]: !bought[id] };
    setBought(next);
    try { await AsyncStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* hết chỗ lưu — tick vẫn đúng trong phiên này */ }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const groups = model?.groups || [];
  const totals = model?.totals;
  const items = model?.items || [];
  const doneCount = items.filter((i) => bought[i.ingredient_id || i.name]).length;
  const donePct = items.length ? (doneCount / items.length) * 100 : 0;

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
            <Text style={styles.title}>{t('mp.shop_title', 'Danh sách đi chợ')}</Text>
            {!!title && <Text style={styles.sub} numberOfLines={1}>{title}</Text>}
          </View>
        </View>

        {totals && (
          <View style={styles.summary}>
            {/* Tiến độ mua — thẻ gradient kèm thanh chạy. Hai con số trần
                "0/56" không cho cảm giác tiến triển, mà đi chợ thì cái người
                dùng muốn thấy nhất là "còn bao nhiêu nữa". */}
            <View style={styles.sumMain}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.sumMainTop}>
                <Ionicons name="cart" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.sumMainLabel}>{t('mp.bought', 'Đã mua')}</Text>
                <Text style={styles.sumMainPct}>{Math.round(donePct)}%</Text>
              </View>
              <Text style={styles.sumMainValue}>
                {doneCount}<Text style={styles.sumMainTotal}>/{totals.itemCount}</Text>
              </Text>
              <View style={styles.sumTrack}>
                <View style={[styles.sumFill, { width: `${donePct}%` }]} />
              </View>
            </View>

            {totals.estimatedCost > 0 && (
              <View style={styles.sumCost}>
                <View style={styles.sumCostIcon}>
                  <Ionicons name="wallet" size={15} color="#8a5a12" />
                </View>
                <Text style={styles.sumCostValue}>
                  {totals.complete ? '' : '≈ '}{money(totals.estimatedCost)} đ
                </Text>
                <Text style={styles.sumCostLabel}>{t('mp.est_cost', 'Ước tính')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Giá là ước tính — nói rõ một lần ở đây thay vì nhắc lại từng dòng. */}
        {totals?.missingPriceCount > 0 && (
          <View style={styles.note}>
            <Ionicons name="information-circle" size={15} color={colors.info} />
            <Text style={styles.noteText}>
              {t('mp.missing_price', 'Có nguyên liệu chưa có giá tham khảo — cột thành tiền để trống.')}
            </Text>
          </View>
        )}

        {groups.map((g) => {
          const c = catOf(g.key);
          return (
          <View key={g.key} style={styles.group}>
            {/* Tiêu đề nhóm có icon + màu riêng, thay cho dòng chữ hoa xám. */}
            <View style={styles.groupHead}>
              <View style={[styles.groupIcon, { backgroundColor: `${c.color}22` }]}>
                <Ionicons name={c.icon} size={13} color={c.color} />
              </View>
              <Text style={[styles.groupLabel, { color: c.color }]}>{g.label}</Text>
              {g.subtotal > 0 && <Text style={styles.groupSub}>{money(g.subtotal)} đ</Text>}
            </View>

            {g.items.map((it) => {
              const id = it.ingredient_id || it.name;
              const on = !!bought[id];
              return (
                <Pressable
                  key={id}
                  onPress={() => toggle(id)}
                  style={({ pressed }) => [
                    styles.row,
                    /* Vạch màu bên trái theo nhóm — cuộn nhanh vẫn biết đang ở
                       khu nào mà không phải đọc lại tiêu đề. */
                    { borderLeftWidth: 3, borderLeftColor: on ? colors.border : c.color },
                    on && styles.rowOn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={on ? colors.primary : colors.borderStrong}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, on && styles.rowDone]}>{it.name}</Text>
                    {it.aliases?.length > 0 && (
                      <Text style={styles.rowAlias}>
                        {t('mp.merged_from', 'Gộp từ')}: {it.aliases.join(', ')}
                      </Text>
                    )}
                    {!!it.manual_price && (
                      <Text style={styles.rowAlias}>
                        {t('mp.price_in_file', 'Giá ghi trong file')}: {it.manual_price}
                      </Text>
                    )}
                  </View>

                  <View style={styles.rowRight}>
                    <Text style={[styles.rowQty, on && styles.rowDone]}>
                      {it.qty == null
                        ? t('mp.need_estimate', 'cần ước lượng')
                        : `${qtyText(it.qty)} ${it.unit || ''}`}
                    </Text>
                    {it.line_total != null && (
                      <Text style={styles.rowCost}>{money(it.line_total)} đ</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          );
        })}

        {!groups.length && (
          <Text style={styles.empty}>
            {t('mp.no_ingredients', 'Chưa có nguyên liệu. Thực đơn này chưa khai báo nguyên liệu cho các món.')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  back: {
    width: 34, height: 34, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  title: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.textMain },
  sub: { fontSize: font.size.sm, color: colors.textSub, marginTop: 2 },

  summary: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },

  sumMain: {
    flex: 1.5, padding: spacing.lg, gap: 6,
    borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 12,
    elevation: 4,
  },
  sumMainTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sumMainLabel: { flex: 1, fontSize: font.size.xs, fontWeight: font.weight.bold, color: 'rgba(255,255,255,0.9)' },
  sumMainPct: { fontSize: font.size.xs, fontWeight: font.weight.heavy, color: '#fff' },
  sumMainValue: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: '#fff', lineHeight: font.size.xxl * 1.15 },
  sumMainTotal: { fontSize: font.size.md, fontWeight: font.weight.bold, color: 'rgba(255,255,255,0.75)' },
  sumTrack: { height: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  sumFill: { height: '100%', borderRadius: radius.full, backgroundColor: '#fff' },

  sumCost: {
    flex: 1, alignItems: 'flex-start', justifyContent: 'center', gap: 4,
    padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(243,156,18,0.28)',
  },
  sumCostIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(243,156,18,0.2)',
  },
  sumCostValue: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: '#8a5a12' },
  sumCostLabel: { fontSize: font.size.xs, color: '#a0763a' },

  note: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.infoSoft,
  },
  noteText: { flex: 1, fontSize: font.size.xs, color: colors.textSub, lineHeight: font.size.xs * 1.5 },

  group: { marginBottom: spacing.lg },
  groupHead: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: spacing.sm,
  },
  groupIcon: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  groupLabel: {
    flex: 1,
    fontSize: font.size.xs, fontWeight: font.weight.heavy,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  groupSub: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textMain },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, marginBottom: 6,
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  /* Đã mua thì lùi hẳn về sau: nền xám nhạt, mờ đi — mắt tự trôi xuống những
     món CHƯA mua, vốn là thứ duy nhất còn phải làm. */
  rowOn: { backgroundColor: colors.surfaceAlt, opacity: 0.72 },
  rowName: { fontSize: font.size.md, color: colors.textMain, fontWeight: font.weight.medium },
  rowAlias: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
  rowDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  rowRight: { alignItems: 'flex-end' },
  rowQty: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMain },
  rowCost: { fontSize: font.size.xs, color: colors.textSub, marginTop: 2 },

  empty: { textAlign: 'center', color: colors.textSub, paddingVertical: spacing.huge },
});
