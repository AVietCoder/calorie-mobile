import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FamilyMenuAPI } from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, font, radius, shadow, spacing } from '../../theme/colors';
import { useI18n } from '../../i18n';

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
            <View style={styles.sumItem}>
              <Text style={styles.sumValue}>{doneCount}/{totals.itemCount}</Text>
              <Text style={styles.sumLabel}>{t('mp.bought', 'Đã mua')}</Text>
            </View>
            {totals.estimatedCost > 0 && (
              <View style={styles.sumItem}>
                <Text style={styles.sumValue}>
                  {totals.complete ? '' : '≈ '}{money(totals.estimatedCost)} đ
                </Text>
                <Text style={styles.sumLabel}>{t('mp.est_cost', 'Ước tính')}</Text>
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

        {groups.map((g) => (
          <View key={g.key} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupLabel}>{g.label}</Text>
              {g.subtotal > 0 && <Text style={styles.groupSub}>{money(g.subtotal)} đ</Text>}
            </View>

            {g.items.map((it) => {
              const id = it.ingredient_id || it.name;
              const on = !!bought[id];
              return (
                <Pressable
                  key={id}
                  onPress={() => toggle(id)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={20}
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
        ))}

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

  summary: {
    flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md,
  },
  sumItem: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    ...shadow.xs,
  },
  sumValue: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.textMain },
  sumLabel: { fontSize: font.size.xs, color: colors.textSub, marginTop: 2 },

  note: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.infoSoft,
  },
  noteText: { flex: 1, fontSize: font.size.xs, color: colors.textSub, lineHeight: font.size.xs * 1.5 },

  group: { marginBottom: spacing.lg },
  groupHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  groupLabel: {
    fontSize: font.size.xs, fontWeight: font.weight.heavy, color: colors.textSub,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  groupSub: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.primary },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, marginBottom: 6,
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowName: { fontSize: font.size.md, color: colors.textMain, fontWeight: font.weight.medium },
  rowAlias: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
  rowDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  rowRight: { alignItems: 'flex-end' },
  rowQty: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMain },
  rowCost: { fontSize: font.size.xs, color: colors.textSub, marginTop: 2 },

  empty: { textAlign: 'center', color: colors.textSub, paddingVertical: spacing.huge },
});
