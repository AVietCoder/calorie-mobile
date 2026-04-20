import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, LineChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { Card, SectionTitle } from '../components/UI';
import { colors, radius, spacing } from '../theme/colors';
import { DietAPI } from '../api/client';
import { useToast } from '../components/Toast';
import { useAuthGuard } from '../hooks/useAuthGuard';

const screenW = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 0,
  color: (o = 1) => `rgba(88, 166, 119, ${o})`,
  labelColor: (o = 1) => `rgba(99, 110, 114, ${o})`,
  propsForBackgroundLines: { stroke: '#eef2ee' },
  fillShadowGradient: colors.primary,
  fillShadowGradientOpacity: 0.4,
};

// Mock data fallback nếu API chưa sẵn
const MOCK = {
  user: { name: 'Bạn', goal: 'Giảm cân', tdee: 2100, bmr: 1500 },
  macros: { protein: 120, carbs: 220, fat: 60 },
  weight_history: [
    { date: 'T2', weight: 70 }, { date: 'T3', weight: 69.6 },
    { date: 'T4', weight: 69.4 }, { date: 'T5', weight: 69.1 },
    { date: 'T6', weight: 68.8 }, { date: 'T7', weight: 68.6 },
    { date: 'CN', weight: 68.4 },
  ],
  weekly_calories: [1900, 2100, 2050, 1980, 2200, 1850, 2000],
};

export default function DietScreen() {
  const { checking } = useAuthGuard();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    try {
      const res = await DietAPI.details();
      setData({ ...MOCK, ...(res || {}) });
    } catch {
      // fallback mock nếu API lỗi
      setData(MOCK);
    } finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);
  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.textSub }}>Đang xác thực...</Text>
      </SafeAreaView>
    );
  }





  if (loading) return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </SafeAreaView>
  );

  const macros = data.macros || MOCK.macros;
  const macroTotal = macros.protein + macros.carbs + macros.fat;
  const macroData = [
    { name: 'Protein', value: macros.protein, color: colors.primary, legendFontColor: '#444', legendFontSize: 12 },
    { name: 'Carbs', value: macros.carbs, color: '#F0B86E', legendFontColor: '#444', legendFontSize: 12 },
    { name: 'Fat', value: macros.fat, color: '#E07A5F', legendFontColor: '#444', legendFontSize: 12 },
  ];
  const weights = (data.weight_history || []).map((w) => w.weight);
  const weightLabels = (data.weight_history || []).map((w) => w.date);
  const cals = data.weekly_calories || MOCK.weekly_calories;

  const tdee = data.user?.tdee || 2100;
  const bmr = data.user?.bmr || 1500;
  const bmrRatio = Math.min(bmr / tdee, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Chúc bạn ngày mới tốt lành!</Text>
            <Text style={styles.subHello}>Mục tiêu: {data.user?.goal || '—'}</Text>
          </View>
          <Ionicons name="notifications-outline" size={24} color={colors.textMain} />
        </View>

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat icon="flame" color="#E07A5F" label="TDEE" value={`${tdee} kcal`} />
          <Stat icon="heart" color={colors.primary} label="BMR" value={`${bmr} kcal`} />
        </View>

        {/* Macro donut */}
        <Card>
          <SectionTitle sub="Hôm nay">Tỷ lệ Macro</SectionTitle>
          <PieChart
            data={macroData} width={screenW - 64} height={180}
            accessor="value" backgroundColor="transparent" paddingLeft="10"
            chartConfig={chartConfig} hasLegend
          />
          <Text style={styles.note}>Tổng: {macroTotal}g</Text>
        </Card>

        {/* Weight progress */}
        <Card>
          <SectionTitle sub="7 ngày qua">Tiến độ cân nặng</SectionTitle>
          <LineChart
            data={{ labels: weightLabels, datasets: [{ data: weights }] }}
            width={screenW - 64} height={200}
            chartConfig={{ ...chartConfig, decimalPlaces: 1 }}
            bezier withInnerLines={false}
            style={{ marginLeft: -10 }}
          />
        </Card>

        {/* Weekly calories */}
        <Card>
          <SectionTitle sub="Calo nạp theo ngày">Tuần này</SectionTitle>
          <BarChart
            data={{ labels: ['T2','T3','T4','T5','T6','T7','CN'], datasets: [{ data: cals }] }}
            width={screenW - 64} height={210}
            chartConfig={chartConfig} fromZero showBarTops={false}
            style={{ marginLeft: -10 }}
          />
        </Card>

        {/* BMR vs TDEE radial */}
        <Card>
          <SectionTitle sub="BMR / TDEE">Năng lượng cơ bản</SectionTitle>
          <ProgressChart
            data={{ labels: ['BMR'], data: [bmrRatio] }}
            width={screenW - 64} height={180} strokeWidth={14} radius={60}
            chartConfig={chartConfig} hideLegend
          />
          <Text style={styles.note}>BMR chiếm {Math.round(bmrRatio * 100)}% TDEE</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, color, label, value }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  hello: { fontSize: 22, fontWeight: '700', color: colors.textMain },
  subHello: { color: colors.textSub, marginTop: 2 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 12, color: colors.textSub, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.textMain },
  note: { textAlign: 'center', color: colors.textSub, marginTop: 6, fontSize: 13 },
});
