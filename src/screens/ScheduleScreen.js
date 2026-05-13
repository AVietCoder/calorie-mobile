import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, SectionTitle } from '../components/UI';
import { ScheduleAPI } from '../api/client';
import { useToast } from '../components/Toast';
import { colors, radius } from '../theme/colors';
import { useAuthGuard } from '../hooks/useAuthGuard';

const DAYS_NAME = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export default function ScheduleScreen() {
  const { checking } = useAuthGuard();
  const toast = useToast();
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Hàm nhóm dữ liệu phẳng thành mảng các ngày (Giống logic xử lý HTML)
  const groupPlanByDay = (flatData) => {
    if (!Array.isArray(flatData)) return [];
    const grouped = flatData.reduce((acc, item) => {
      const dayNum = item.day || 1;
      if (!acc[dayNum]) {
        acc[dayNum] = { day: dayNum, meals: [] };
      }
      acc[dayNum].meals.push({
        time: item.meal,
        name: item.food,
        kcal: item.calories,
        amount: item.amount,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs
      });
      return acc;
    }, {});
    // Chuyển object thành mảng và sắp xếp theo ngày
    return Object.values(grouped).sort((a, b) => a.day - b.day);
  };

  const load = async ({ silent = false } = {}) => {
  if (!silent) setLoading(true);
  try {
    // 1) Lấy plan có sẵn (không tốn AI)
    const res = await ScheduleAPI.getPlan();
    let rawData = res?.newPlan || (Array.isArray(res) ? res : []);

    // 2) Nếu DB chưa có plan nào → tự generate lần đầu (giống hành vi web)
    if (!Array.isArray(rawData) || rawData.length === 0) {
      setGenerating(true);
      try {
        const gen = await ScheduleAPI.generate(); // body {} → backend quyết định
        rawData = gen?.newPlan || [];
        if (rawData.length) toast.show('Đã tạo thực đơn cho bạn', 'success');
      } finally {
        setGenerating(false);
      }
    }

    setPlan(groupPlanByDay(rawData));
  } catch (err) {
    console.error('[ScheduleScreen.load]', err);
    toast.show(err.message || 'Không thể tải thực đơn', 'error');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};


  useEffect(() => {
    if (!checking) load();
  }, [checking]);

  const regenerate = async () => {
  setGenerating(true);
  try {
    const res = await ScheduleAPI.generate(); // body rỗng → backend gen mới nếu đủ điều kiện
    const rawData = res?.newPlan || [];
    if (rawData.length === 0) {
      toast.show('Plan tuần này vẫn còn hiệu lực, chưa cần tạo mới', 'info');
    } else {
      setPlan(groupPlanByDay(rawData));
      toast.show(res?.reply || 'Đã tạo kế hoạch mới', 'success');
    }
  } catch (e) {
    toast.show(e.message || 'Lỗi tạo kế hoạch', 'error');
  } finally {
    setGenerating(false);
  }
};


 if (loading || checking) return (
  <SafeAreaView style={styles.centerView}>
    <ActivityIndicator color={colors.primary} size="large" />
    <Text style={{ marginTop: 12, color: colors.textSub }}>
      {generating ? 'AI đang lên thực đơn 7 ngày cho bạn…' : 'Đang tải…'}
    </Text>
  </SafeAreaView>
);


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => { setRefreshing(true); load(); }} 
            tintColor={colors.primary} 
          />
        }
      >
        <View style={styles.headerRow}>
          <SectionTitle sub="AI Coach 7 ngày">Lộ trình thực đơn</SectionTitle>
          <Button 
            title="Tạo mới" 
            variant="secondary" 
            onPress={regenerate} 
            loading={generating}
            icon={<Ionicons name="sparkles" size={16} color={colors.primary} />} 
            style={styles.regenBtn} 
          />
        </View>

        {plan.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Chưa có thực đơn tuần này.</Text>
          </View>
        ) : (
          plan.map((day, i) => (
            <Card key={i} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={styles.dayDot}>
                  <Text style={styles.dayDotText}>{day.day}</Text>
                </View>
                <Text style={styles.dayTitle}>
                  {DAYS_NAME[day.day - 1] || `Ngày ${day.day}`}
                </Text>
              </View>

              {day.meals.map((m, j) => (
                <View key={j} style={styles.mealRow}>
                  <View style={styles.mealInfo}>
                    <View style={styles.mealTop}>
                      <View style={[
                        styles.timeChip, 
                        m.time === 'Sáng' && { backgroundColor: '#FEF3C7' }, 
                        m.time === 'Trưa' && { backgroundColor: '#DBEAFE' }, 
                        m.time === 'Tối' && { backgroundColor: '#FCE7F3' },
                        m.time === 'Phụ' && { backgroundColor: '#E0F2FE' }
                      ]}>
                        <Text style={styles.timeText}>{m.time}</Text>
                      </View>
                      <Text style={styles.kcalText}>{m.kcal} kcal</Text>
                    </View>
                    
                    <Text style={styles.foodName}>{m.name}</Text>
                    <Text style={styles.amountText}>Định lượng: {m.amount}</Text>
                    
                    <View style={styles.macroRow}>
                      <Text style={styles.macroText}>P: {m.protein}g</Text>
                      <Text style={styles.macroText}>F: {m.fat}g</Text>
                      <Text style={styles.macroText}>C: {m.carbs}g</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  regenBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  dayCard: { padding: 16 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  dayDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  dayDotText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  dayTitle: { fontSize: 18, fontWeight: '800', color: colors.textMain },
  mealRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  mealInfo: { gap: 4 },
  mealTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  timeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, minWidth: 60, alignItems: 'center' },
  timeText: { fontSize: 12, fontWeight: '800', color: '#444' },
  kcalText: { fontSize: 14, color: colors.primary, fontWeight: '800' },
  foodName: { fontSize: 15, fontWeight: '600', color: colors.textMain, lineHeight: 20 },
  amountText: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  macroRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  macroText: { fontSize: 11, color: '#666', fontWeight: '500' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: colors.muted },
});