import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Dimensions, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { DonutChart, BarGoalChart, PolarAreaChart, WeekLinesChart } from '../components/Charts';
import { Card, SectionTitle, Button } from '../components/UI';
import { colors, radius, shadow } from '../theme/colors';
import { DietAPI, StatusAPI, ScheduleAPI, DiaryAPI } from '../api/client';
import { getLastDays } from '../storage/intake';
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

// goal id -> khoá i18n (label dịch theo ngôn ngữ hiện tại trong render)
const GOAL_KEY = {
  lose: ['setup.goal_lose', 'Giảm cân'],
  maintain: ['setup.goal_maintain', 'Giữ cân'],
  gain: ['setup.goal_gain', 'Tăng cân'],
  muscle: ['setup.goal_muscle', 'Tăng cơ'],
  disease: ['setup.goal_disease', 'Hỗ trợ điều trị bệnh'],
};

export default function DietScreen({ navigation }) {
  const { checking } = useAuthGuard();
  const { t, lang, localizeDisease } = useI18n();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Thống kê 7 ngày + cảnh báo sức khỏe (tính năng mới — đồng bộ web diet-details)
  const [weekDays, setWeekDays] = useState([]);
  const [diary, setDiary] = useState([]);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState(null); // { status, summary, advice }

  const runHealthCheck = useCallback(async () => {
    const days = weekDays.filter((x) => x.calories > 0);
    if (!days.length) {
      toast.show(t('week.no_data', 'Chưa có dữ liệu — hãy tick "Đã ăn" ở trang Kế hoạch để hệ thống thống kê.'), 'info');
      return;
    }
    setHealthChecking(true);
    try {
      const res = await ScheduleAPI.healthCheck(days, lang);
      if (res?.success) {
        setHealthResult({
          status: res.status || 'stable',
          summary: res.summary || '',
          advice: Array.isArray(res.advice) ? res.advice : [],
        });
      } else {
        toast.show(res?.error || t('toast.coach_net_err', 'Lỗi kết nối HLV AI'), 'error');
      }
    } catch (e) {
      toast.show(e.message || t('toast.coach_net_err', 'Lỗi kết nối HLV AI'), 'error');
    } finally {
      setHealthChecking(false);
    }
  }, [weekDays, lang, t, toast]);

  const load = useCallback(async () => {
    try {
      // Giống web (diet-details.js): chưa hoàn tất setup -> đưa về trang thiết lập lộ trình
      const [statusRes, res] = await Promise.all([
        StatusAPI.get().catch(() => null),
        DietAPI.info(),
      ]);
      if (statusRes?.success && !statusRes.is_setup_completed) {
        navigation?.navigate?.('Profile');
        return;
      }
      if (res?.success && res.data) setD(res.data);
      else setD(FALLBACK);
      // Nạp dữ liệu ăn uống 7 ngày (local) cho biểu đồ tuần & cảnh báo sức khỏe
      try { setWeekDays(await getLastDays(7)); } catch {}
      // D: nhật ký ảnh món ăn (server) — phụ, lỗi thì bỏ qua
      try { const dr = await DiaryAPI.list(60); if (dr?.success) setDiary(Array.isArray(dr.items) ? dr.items : []); } catch {}
    } catch {
      setD(FALLBACK);
      toast.show(t('toast.diet_load_fail', 'Không thể tải dữ liệu lộ trình'), 'error');
    } finally { setLoading(false); setRefreshing(false); }
  }, [t, toast]); // eslint-disable-line

  useEffect(() => { if (!checking) load(); }, [checking]); // eslint-disable-line

  // Web tải lại dữ liệu mỗi lần mở trang -> mobile tải lại (im lặng) khi tab được focus,
  // để sau khi hoàn tất setup / xác nhận bữa ăn số liệu luôn mới.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      if (!checking) load();
    }, [checking, load]),
  );

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
  // Macro doughnut THEO KCAL (giống web renderMacroChart: P*4 / C*4 / F*9, cutout 72%)
  const macroData = [
    { value: (Number(macros.protein) || 0) * 4, color: '#c25b4a', label: `${t('chart.protein', 'Protein')} ${Math.round(macros.protein)}g` },
    { value: (Number(macros.carbs) || 0) * 4, color: '#b8975a', label: `${t('chart.carbs', 'Carbs')} ${Math.round(macros.carbs)}g` },
    { value: (Number(macros.fat) || 0) * 9, color: '#7d9b76', label: `${t('chart.fats', 'Fats')} ${Math.round(macros.fat)}g` },
  ];

  // Tiến độ cân nặng (suy ra như web)
  const sW = Number(profile.start_weight) || Number(profile.weight) || 0;
  const curW = Number(profile.weight) || 0;
  const tgtW = Number(profile.target_weight) || curW;
  const weightSeries = [sW, +(sW + (curW - sW) * 0.5).toFixed(1), curW, tgtW];
  const weightLabels = [t('chart.start', 'Bắt đầu'), '...', t('chart.current', 'Hiện tại'), t('chart.target', 'Mục tiêu')];
  // Đường mục tiêu (web: dataset gold, borderDash) — chart-kit không hỗ trợ dash,
  // dùng dataset màu gold liền để giữ đúng ý nghĩa.
  const targetLine = weightLabels.map(() => tgtW);

  // Calo theo ngày (suy ra từ target như web)
  const variation = [1.0, 0.96, 1.02, 0.98, 1.05, 1.1, 1.04];
  const weekly = variation.map((v) => Math.round((calories || 2000) * v));
  const weekLabels = [t('chart.mon', 'T2'), t('chart.tue', 'T3'), t('chart.wed', 'T4'), t('chart.thu', 'T5'), t('chart.fri', 'T6'), t('chart.sat', 'T7'), t('chart.sun', 'CN')];

  // Bệnh lý
  let diseaseList = [];
  const rawDisease = profile.disease;
  if (Array.isArray(rawDisease)) diseaseList = rawDisease.filter(Boolean);
  else if (typeof rawDisease === 'string') diseaseList = rawDisease.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

  const goalEntry = GOAL_KEY[String(profile.goal || '').split(',')[0]];
  const goalText = goalEntry ? t(goalEntry[0], goalEntry[1]) : (profile.goal || '—');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}
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

        {/* Macro donut — giống web: cutout 72%, tổng kcal ở tâm */}
        <Card>
          <SectionTitle sub={t('diet.macro_ratio', 'Tỉ lệ Macro đề xuất')}>{t('chart.protein', 'Protein')} · {t('chart.carbs', 'Carbs')} · {t('chart.fats', 'Fats')}</SectionTitle>
          <DonutChart
            size={180} cutout={0.72} data={macroData}
            centerTop={calories.toLocaleString()} centerBottom={t('common.kcal', 'kcal')}
          />
        </Card>

        {/* Weight progress — có đường mục tiêu màu vàng (web: dataset gold, dashed) */}
        <Card>
          <SectionTitle sub={t('diet.weight_progress', 'Tiến độ cân nặng')}>{t('chart.weight_kg', 'Cân nặng (kg)')}</SectionTitle>
          <LineChart
            data={{
              labels: weightLabels,
              datasets: [
                { data: weightSeries, color: (o = 1) => `rgba(125, 155, 118, ${o})`, strokeWidth: 3 },
                { data: targetLine, color: (o = 1) => `rgba(184, 151, 90, ${o})`, strokeWidth: 2, withDots: false },
              ],
              legend: [t('chart.weight_kg', 'Cân nặng (kg)'), t('chart.target', 'Mục tiêu')],
            }}
            width={screenW - 64} height={200}
            chartConfig={{ ...chartConfig, decimalPlaces: 1 }}
            bezier withInnerLines={false} style={{ marginLeft: -10 }}
          />
        </Card>

        {/* Weekly calories — bar + goal line nét đứt vàng (giống web) */}
        <Card>
          <SectionTitle sub={t('diet.cal_per_day', 'Calo theo từng ngày trong tuần')}>{t('chart.cal_intake_est', 'Calo nạp (ước tính)')}</SectionTitle>
          <BarGoalChart
            width={screenW - 64} height={210}
            labels={weekLabels} data={weekly}
            goal={calories} goalLabel={t('chart.target', 'Mục tiêu')}
            barColor="#7d9b76" goalColor="#b8975a" unit={t('common.kcal', 'kcal')}
          />
        </Card>

        {/* BMR vs TDEE — doughnut 2 phần (web: primaryDeep + gold, cutout 68%) */}
        <Card>
          <SectionTitle sub="BMR / TDEE">{t('chart.bmr_basal', 'BMR (cơ bản)')}</SectionTitle>
          <DonutChart
            size={170} cutout={0.68}
            data={[
              { value: bmr, color: '#4d6549', label: `${t('chart.bmr_basal', 'BMR (cơ bản)')} ${bmr.toLocaleString()}` },
              { value: Math.max(0, tdee - bmr), color: '#b8975a', label: `${t('chart.activity', 'Vận động')} ${Math.max(0, tdee - bmr).toLocaleString()}` },
            ]}
          />
        </Card>

        {/* Tổng quan năng lượng — polarArea BMR/TDEE/Mục tiêu (web renderEnergyChart) */}
        <Card>
          <SectionTitle sub={t('diet.energy_overview', 'Tổng quan năng lượng')}>{t('chart.bmr', 'BMR')} · {t('chart.tdee', 'TDEE')} · {t('chart.target', 'Mục tiêu')}</SectionTitle>
          <PolarAreaChart
            size={Math.min(screenW - 96, 260)}
            unit={t('common.kcal', 'kcal')}
            data={[
              { value: bmr, color: 'rgba(77,101,73,0.55)', border: '#4d6549', label: t('chart.bmr', 'BMR') },
              { value: tdee, color: 'rgba(125,155,118,0.55)', border: '#7d9b76', label: t('chart.tdee', 'TDEE') },
              { value: calories, color: 'rgba(184,151,90,0.55)', border: '#b8975a', label: t('chart.target', 'Mục tiêu') },
            ]}
          />
        </Card>

        {/* ── THỐNG KÊ 7 NGÀY + CẢNH BÁO SỨC KHỎE (tính năng mới — đồng bộ web) ── */}
        <Card>
          <SectionTitle sub={t('week.sub', 'Các chất đã nạp mỗi ngày so với mức khuyến nghị')}>{t('week.chart_title', 'Chất dinh dưỡng đã nạp vs khuyến nghị')}</SectionTitle>
          {weekDays.some((x) => x.calories > 0) ? (
            <WeekLinesChart
              width={screenW - 64} height={200} unit="g"
              labels={weekDays.map((x) => x.date.slice(8, 10) + '/' + x.date.slice(5, 7))}
              series={[
                { name: t('chart.protein', 'Protein'), color: '#c25b4a', data: weekDays.map((x) => Math.round(x.protein)), target: macros.protein },
                { name: t('chart.fats', 'Fats'), color: '#7d9b76', data: weekDays.map((x) => Math.round(x.fat)), target: macros.fat },
                { name: t('chart.carbs', 'Carbs'), color: '#b8975a', data: weekDays.map((x) => Math.round(x.carbs)), target: macros.carbs },
              ]}
            />
          ) : (
            <Text style={styles.weekEmpty}>{t('week.no_data', 'Chưa có dữ liệu — hãy tick "Đã ăn" ở trang Kế hoạch để hệ thống thống kê.')}</Text>
          )}
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="pulse" size={18} color={colors.primary} />
            <Text style={styles.cardHeadTitle}>{t('week.health_title', 'Cảnh báo sức khỏe 7 ngày')}</Text>
          </View>
          <Text style={styles.cardHeadDesc}>{t('week.health_desc', 'AI phân tích hành vi ăn uống 7 ngày gần nhất, dự đoán xu hướng tình trạng bệnh và đưa lời khuyên.')}</Text>

          {healthResult && (
            <View style={{ marginTop: 12 }}>
              <View style={[styles.healthBadge, {
                backgroundColor: healthResult.status === 'good' ? colors.primarySoft
                  : healthResult.status === 'risk' ? '#FDECEA' : '#FDF6E8',
              }]}>
                <Ionicons
                  name={healthResult.status === 'good' ? 'checkmark-circle' : healthResult.status === 'risk' ? 'warning' : 'remove-circle'}
                  size={15}
                  color={healthResult.status === 'good' ? colors.primaryDark : healthResult.status === 'risk' ? colors.danger : '#B8975A'}
                />
                <Text style={[styles.healthBadgeText, {
                  color: healthResult.status === 'good' ? colors.primaryDark
                    : healthResult.status === 'risk' ? colors.danger : '#B8975A',
                }]}>
                  {healthResult.status === 'good' ? t('week.status_good', 'Đang cải thiện tốt')
                    : healthResult.status === 'risk' ? t('week.status_risk', 'Có nguy cơ xấu đi')
                    : t('week.status_stable', 'Duy trì ổn định')}
                </Text>
              </View>
              {!!healthResult.summary && <Text style={styles.healthSummary}>{healthResult.summary}</Text>}
              {healthResult.advice.length > 0 && (
                <View style={{ marginTop: 8, gap: 4 }}>
                  <Text style={styles.healthAdviceLabel}>{t('week.advice', 'Lời khuyên')}</Text>
                  {healthResult.advice.map((a, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 7 }}>
                      <Text style={{ color: colors.primary, fontWeight: '800' }}>•</Text>
                      <Text style={styles.healthAdviceText}>{a}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <Button
            title={healthChecking ? t('week.analyzing', 'AI đang phân tích...') : t('week.analyze', 'Phân tích bằng AI')}
            onPress={runHealthCheck}
            loading={healthChecking}
            icon={<Ionicons name="sparkles" size={15} color="#fff" />}
            style={{ marginTop: 14 }}
          />
        </Card>

        {/* D: Nhật ký ảnh món ăn */}
        {diary.length > 0 && (
          <Card style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="images" size={16} color={colors.primaryDark} />
              <Text style={styles.diaryTitle}>{t('diary.title', 'Nhật ký ảnh món ăn')}</Text>
            </View>
            <Text style={styles.diarySub}>{t('diary.sub', 'Những món bạn đã chụp và phân tích gần đây.')}</Text>
            <View style={styles.diaryGrid}>
              {diary.slice(0, 12).map((it) => {
                const a = it.analysis || {};
                const kcal = a.calories != null ? `${Math.round(a.calories)} kcal` : '';
                let dd = '';
                try { const d = new Date(it.created_at); dd = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; } catch {}
                return (
                  <View key={it.id} style={styles.diaryItem}>
                    <Image source={{ uri: it.url }} style={styles.diaryImg} />
                    <View style={{ padding: 7 }}>
                      <Text style={styles.diaryFood} numberOfLines={1}>{a.food || t('extra.detected', 'Món ăn')}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 }}>
                        <Text style={styles.diaryMeta}><Ionicons name="flame" size={10} color="#e8743b" /> {kcal}</Text>
                        <Text style={styles.diaryMeta}>{dd}</Text>
                      </View>
                      {a.confidence === 'low' && (
                        <Text style={styles.diaryLowConf}>{t('extra.low_conf', 'Giá trị chỉ mang tính ước lượng.')}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}
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
  diaryTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  diarySub: { fontSize: 12.5, color: colors.textSub, marginBottom: 12 },
  diaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  diaryItem: { width: '47%', borderWidth: 1, borderColor: colors.borderSoft || '#eee', borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface || '#fff' },
  diaryImg: { width: '100%', aspectRatio: 1, backgroundColor: '#f2f2f2' },
  diaryFood: { fontSize: 12.5, fontWeight: '700', color: colors.textMain },
  diaryMeta: { fontSize: 11, color: colors.textSub },
  diaryLowConf: { fontSize: 10.5, color: '#b8860b', marginTop: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, marginBottom: 2 },
  hello: { fontSize: 20, fontWeight: '700', color: colors.textMain, letterSpacing: -0.3 },
  subHello: { color: colors.textSub, marginTop: 2, fontSize: 12.5, lineHeight: 17 },
  // Đồng bộ với Card (viền mảnh + đổ bóng nhẹ) để ô số liệu không bị "phẳng/thô".
  stat: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14,
    flexDirection: 'row', gap: 10, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.xs,
  },
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

  /* thống kê 7 ngày + cảnh báo sức khỏe */
  weekEmpty: { fontSize: 12.5, color: colors.muted, lineHeight: 18, textAlign: 'center', paddingVertical: 14 },
  healthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  healthBadgeText: { fontSize: 12.5, fontWeight: '800' },
  healthSummary: { fontSize: 13.5, color: colors.textMain, lineHeight: 20, marginTop: 10 },
  healthAdviceLabel: { fontSize: 12, fontWeight: '800', color: colors.primaryDark, marginTop: 2 },
  healthAdviceText: { flex: 1, fontSize: 13, color: colors.textMain, lineHeight: 19 },
});
