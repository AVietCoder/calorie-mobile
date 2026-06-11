import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, LineChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { Card, SectionTitle } from '../components/UI';
import { colors, radius } from '../theme/colors';
import { DietAPI } from '../api/client';
import { useToast } from '../components/Toast';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useI18n } from '../i18n';
import { ReminderBell, LangSwitch } from '../components/HeaderWidgets';

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

// Phương án dự phòng nếu chưa hoàn tất setup / API lỗi
const FALLBACK = {
  calories: 2000, bmr: 1600, tdee: 2200,
  macros: { protein: 140, carbs: 220, fat: 60 },
  profile: { goal: 'lose', weight: 74, target_weight: 68, start_weight: 78, deadline: '01/12/2025', disease: '' },
};

const GOAL_LABEL = {
  lose: 'Giảm cân', maintain: 'Giữ cân', gain: 'Tăng cân', muscle: 'Tăng cơ', disease: 'Hỗ trợ điều trị bệnh',
};

export default function DietScreen() {
  const { checking } = useAuthGuard();
  const { t, localizeDisease } = useI18n();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await DietAPI.info();
      if (res?.success && res.data) setD(res.data);
      else setD(FALLBACK);
    } catch {
      setD(FALLBACK);
      toast.show(t('toast.diet_load_fail', 'Không thể tải dữ liệu lộ trình'), 'error');
    } finally { setLoading(false); setRefreshing(false); }
  }, [t, toast]);

  useEffect(() => { if (!checking) load(); }, [checking]); // eslint-disable-line

  if (checking || loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.textSub }}>
          {checking ? t('m.auth_checking', 'Đang xác thực...') : t('m.loading', 'Đang tải…')}
        </Text>
      </SafeAreaView>
    );
  }

  const data = d || FALLBACK;
  const macros = data.macros || FALLBACK.macros;
  const profile = data.profile || {};
  const calories = Number(data.calories) || 0;
  const tdee = Number(data.tdee) || 0;
  const bmr = Number(data.bmr) || 0;
  const bmrRatio = tdee > 0 ? Math.min(bmr / tdee, 1) : 0;

  // Pie macro (gram)
  const macroData = [
    { name: t('chart.protein', 'Protein'), value: macros.protein, color: '#c25b4a', legendFontColor: '#444', legendFontSize: 12 },
    { name: t('chart.carbs', 'Carbs'), value: macros.carbs, color: '#b8975a', legendFontColor: '#444', legendFontSize: 12 },
    { name: t('chart.fats', 'Fats'), value: macros.fat, color: '#7d9b76', legendFontColor: '#444', legendFontSize: 12 },
  ];

  // Tiến độ cân nặng (suy ra như web)
  const sW = Number(profile.start_weight) || Number(profile.weight) || 0;
  const curW = Number(profile.weight) || 0;
  const tgtW = Number(profile.target_weight) || curW;
  const weightSeries = [sW, +(sW + (curW - sW) * 0.5).toFixed(1), curW, tgtW];
  const weightLabels = [t('chart.start', 'Bắt đầu'), '...', t('chart.current', 'Hiện tại'), t('chart.target', 'Mục tiêu')];

  // Calo theo ngày (suy ra từ target như web)
  const variation = [1.0, 0.96, 1.02, 0.98, 1.05, 1.1, 1.04];
  const weekly = variation.map((v) => Math.round((calories || 2000) * v));
  const weekLabels = [t('chart.mon', 'T2'), t('chart.tue', 'T3'), t('chart.wed', 'T4'), t('chart.thu', 'T5'), t('chart.fri', 'T6'), t('chart.sat', 'T7'), t('chart.sun', 'CN')];

  // Bệnh lý
  let diseaseList = [];
  const rawDisease = profile.disease;
  if (Array.isArray(rawDisease)) diseaseList = rawDisease.filter(Boolean);
  else if (typeof rawDisease === 'string') diseaseList = rawDisease.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

  const goalText = GOAL_LABEL[String(profile.goal || '').split(',')[0]] || profile.goal || '—';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{t('diet.nutri_title', 'Phân tích dinh dưỡng')}</Text>
            <Text style={styles.subHello}>{t('diet.nutri_sub', 'Tỉ lệ macro & tiến độ cân nặng theo lộ trình')}</Text>
          </View>
          <LangSwitch style={{ marginRight: 10 }} />
          <ReminderBell />
        </View>

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat icon="flame" color="#E07A5F" label="TDEE" value={`${tdee} ${t('common.kcal', 'kcal')}`} />
          <Stat icon="heart" color={colors.primary} label="BMR" value={`${bmr} ${t('common.kcal', 'kcal')}`} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat icon="restaurant" color="#D4A017" label={t('diet.daily_target', 'Mục tiêu nạp mỗi ngày')} value={`${calories.toLocaleString()} ${t('common.kcal', 'kcal')}`} />
          <Stat icon="trending-down" color={colors.info} label={t('setup.goal_title', 'Mục tiêu')} value={goalText} />
        </View>

        {/* Weight + target + deadline */}
        <Card>
          <View style={styles.wRow}>
            <WStat label={t('diet.weight_now', 'Cân nặng hiện tại')} value={`${profile.weight ?? '—'} kg`} />
            <WStat label={t('diet.target_to', 'Mục tiêu hướng đến')} value={`${profile.target_weight ?? '—'} kg`} />
            <WStat label={t('diet.deadline', 'Thời hạn (Deadline)')} value={profile.deadline || '—'} />
          </View>
        </Card>

        {/* Bệnh lý cần lưu ý */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="medkit" size={18} color={diseaseList.length ? colors.danger : colors.primary} />
            <Text style={styles.cardHeadTitle}>
              {diseaseList.length === 0
                ? t('diet.disease_none_title', 'Không có bệnh nền')
                : diseaseList.length === 1
                  ? t('diet.disease_one_title', 'Lưu ý chế độ ăn cho tình trạng sức khoẻ')
                  : `${t('diet.personalized', 'Cá nhân hoá')} · ${diseaseList.length}`}
            </Text>
          </View>
          <Text style={styles.cardHeadDesc}>
            {diseaseList.length === 0
              ? t('diet.disease_none_desc', 'Bạn chưa khai báo bệnh lý nào. Thực đơn sẽ tối ưu cho mục tiêu cân nặng & năng lượng.')
              : t('diet.disease_warn_desc', 'Vui lòng chú ý lựa chọn thực phẩm phù hợp. Hệ thống sẽ ưu tiên cảnh báo món ăn không tốt cho các bệnh lý dưới đây.')}
          </Text>
          {diseaseList.length > 0 && (
            <View style={styles.tagsWrap}>
              {diseaseList.map((name, i) => (
                <View key={i} style={styles.diseaseTag}>
                  <Ionicons name="alert-circle" size={13} color={colors.danger} />
                  <Text style={styles.diseaseTagText}>{localizeDisease(name)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Macro donut */}
        <Card>
          <SectionTitle sub={t('diet.macro_ratio', 'Tỉ lệ Macro đề xuất')}>{t('chart.protein', 'Protein')} · {t('chart.carbs', 'Carbs')} · {t('chart.fats', 'Fats')}</SectionTitle>
          <PieChart
            data={macroData} width={screenW - 64} height={180}
            accessor="value" backgroundColor="transparent" paddingLeft="10"
            chartConfig={chartConfig} hasLegend
          />
        </Card>

        {/* Weight progress */}
        <Card>
          <SectionTitle sub={t('diet.weight_progress', 'Tiến độ cân nặng')}>{t('chart.weight_kg', 'Cân nặng (kg)')}</SectionTitle>
          <LineChart
            data={{ labels: weightLabels, datasets: [{ data: weightSeries }] }}
            width={screenW - 64} height={200}
            chartConfig={{ ...chartConfig, decimalPlaces: 1 }}
            bezier withInnerLines={false} style={{ marginLeft: -10 }}
          />
        </Card>

        {/* Weekly calories */}
        <Card>
          <SectionTitle sub={t('diet.cal_per_day', 'Calo theo từng ngày trong tuần')}>{t('chart.cal_intake_est', 'Calo nạp (ước tính)')}</SectionTitle>
          <BarChart
            data={{ labels: weekLabels, datasets: [{ data: weekly }] }}
            width={screenW - 64} height={210}
            chartConfig={chartConfig} fromZero showBarTops={false} style={{ marginLeft: -10 }}
          />
        </Card>

        {/* BMR vs TDEE */}
        <Card>
          <SectionTitle sub="BMR / TDEE">{t('chart.bmr_basal', 'BMR (cơ bản)')}</SectionTitle>
          <ProgressChart
            data={{ labels: ['BMR'], data: [bmrRatio] }}
            width={screenW - 64} height={180} strokeWidth={14} radius={60}
            chartConfig={chartConfig} hideLegend
          />
          <Text style={styles.note}>BMR {Math.round(bmrRatio * 100)}% TDEE</Text>
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
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function WStat({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.wLabel} numberOfLines={2}>{label}</Text>
      <Text style={styles.wValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  hello: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  subHello: { color: colors.textSub, marginTop: 2, fontSize: 12.5 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: colors.textSub, fontWeight: '600' },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  wRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wLabel: { fontSize: 11, color: colors.textSub, textAlign: 'center', marginBottom: 4 },
  wValue: { fontSize: 15, fontWeight: '800', color: colors.textMain },
  cardHeadTitle: { fontSize: 15, fontWeight: '800', color: colors.textMain, flex: 1 },
  cardHeadDesc: { fontSize: 12.5, color: colors.textSub, lineHeight: 18 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  diseaseTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FDECEA', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
  },
  diseaseTagText: { fontSize: 12.5, fontWeight: '600', color: colors.danger },
  note: { textAlign: 'center', color: colors.textSub, marginTop: 6, fontSize: 13 },
});
