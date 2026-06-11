import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, SectionTitle } from '../components/UI';
import { ScheduleAPI, DietAPI, FoodAPI } from '../api/client';
import { useToast } from '../components/Toast';
import { colors, radius } from '../theme/colors';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useI18n } from '../i18n';
import { ReminderBell } from '../components/HeaderWidgets';
import MealDetailModal from '../components/MealDetailModal';
import {
  getToday, setEaten, setSkipped, addExtra, removeExtra,
  computeTotals, parseMacro, todayPlanDay,
} from '../storage/intake';

const MEAL_ORDER = { 'Sáng': 0, 'Trưa': 1, 'Tối': 2, 'Phụ': 3 };

export default function ScheduleScreen({ navigation }) {
  const { checking } = useAuthGuard();
  const { t, localizeFood } = useI18n();
  const toast = useToast();

  const [flatPlan, setFlatPlan] = useState([]); // [{day, meal, food, calories, ...}]
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expired, setExpired] = useState(false);

  const [dayIntake, setDayIntake] = useState({ eaten: {}, skipped: {}, extras: [] });
  const [target, setTarget] = useState({ calories: 0, macros: { protein: 0, fat: 0, carbs: 0 } });

  // Meal modal
  const [modalItem, setModalItem] = useState(null);

  // Extra food form
  const [extraOpen, setExtraOpen] = useState(false);
  const [exName, setExName] = useState('');
  const [exKcal, setExKcal] = useState('');
  const [exP, setExP] = useState('');
  const [exF, setExF] = useState('');
  const [exC, setExC] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const pday = todayPlanDay();

  const refreshIntake = useCallback(async () => {
    const { day } = await getToday();
    setDayIntake({ ...day });
  }, []);

  const flatten = (raw) => {
    if (!Array.isArray(raw)) return [];
    const out = [];
    raw.forEach((entry) => {
      if (entry && Array.isArray(entry.meals)) {
        entry.meals.forEach((m) => out.push({ ...m, day: Number(entry.day) }));
      } else if (entry && (entry.meal || entry.food)) {
        out.push({ ...entry, day: Number(entry.day) });
      }
    });
    return out;
  };

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      // Mục tiêu calo/macro hôm nay
      try {
        const diet = await DietAPI.info();
        if (diet?.success && diet.data) {
          setTarget({
            calories: Number(diet.data.calories) || 0,
            macros: {
              protein: Number(diet.data.macros?.protein) || 0,
              fat: Number(diet.data.macros?.fat) || 0,
              carbs: Number(diet.data.macros?.carbs) || 0,
            },
          });
        }
      } catch {}

      // Plan có sẵn
      const res = await ScheduleAPI.getPlan();
      setExpired(!!res?.isDeadlinePassed);
      let raw = res?.newPlan || (Array.isArray(res) ? res : []);

      // Chưa có plan → generate lần đầu
      if ((!Array.isArray(raw) || raw.length === 0) && !res?.isDeadlinePassed) {
        setGenerating(true);
        try {
          const gen = await ScheduleAPI.generate();
          raw = gen?.newPlan || [];
          if (raw.length) toast.show(t('m.plan_made', 'Đã tạo thực đơn cho bạn'), 'success');
        } finally { setGenerating(false); }
      }

      setFlatPlan(flatten(raw));
      await refreshIntake();
    } catch (err) {
      console.error('[ScheduleScreen.load]', err);
      toast.show(err.message || t('toast.coach_net_err', 'Lỗi kết nối HLV AI'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshIntake, t, toast]);

  useEffect(() => { if (!checking) load(); }, [checking]); // eslint-disable-line

  const regenerate = async () => {
    setGenerating(true);
    try {
      const res = await ScheduleAPI.generate();
      const raw = res?.newPlan || [];
      if (raw.length === 0) {
        toast.show(t('m.plan_valid', 'Plan tuần này vẫn còn hiệu lực, chưa cần tạo mới'), 'info');
      } else {
        setFlatPlan(flatten(raw));
        toast.show(res?.reply || t('m.plan_new', 'Đã tạo kế hoạch mới'), 'success');
      }
    } catch (e) {
      toast.show(e.message || t('m.plan_err', 'Lỗi tạo kế hoạch'), 'error');
    } finally { setGenerating(false); }
  };

  /* ── Hành động trên 1 bữa ── */
  const onToggleEaten = async (item) => {
    const key = `${pday}-${item.meal}`;
    const next = !dayIntake.eaten?.[key];
    const day = await setEaten(pday, item.meal, next);
    setDayIntake({ ...day });
  };

  const onEat = async (item) => {
    if (Number(item.day) === pday) {
      const day = await setEaten(pday, item.meal, true);
      setDayIntake({ ...day });
    }
  };

  const onSkip = async (item) => {
    const day = await setSkipped(pday, item.meal, true);
    setDayIntake({ ...day });
    toast.show(t('sch.skip_saved', 'Đã đánh dấu bỏ bữa này'), 'info');
  };

  const onChangeMeal = async (item, newFood) => {
    toast.show(t('toast.recalc', 'Đang tính lại dinh dưỡng món bạn đổi...'), 'info');
    try {
      const res = await ScheduleAPI.updatePlan([{ day: item.day, meal: item.meal, food: newFood }]);
      if (res?.success) {
        setFlatPlan(flatten(res.newPlan || []));
        toast.show(res.message || t('toast.update_ok', 'Đã cập nhật & tính lại dinh dưỡng!'), 'success');
      } else {
        toast.show(res?.error || t('toast.save_net_err', 'Lỗi kết nối khi lưu'), 'error');
      }
    } catch (e) {
      toast.show(e.message || t('toast.save_net_err', 'Lỗi kết nối khi lưu'), 'error');
    }
  };

  const onAskAI = (item) => {
    const prefill = `Cho tôi biết thêm về món ${item.food || ''}`.trim();
    navigation?.navigate?.('Chat', { prefill });
  };

  /* ── Món ngoài thực đơn ── */
  const resetExtra = () => { setExName(''); setExKcal(''); setExP(''); setExF(''); setExC(''); };

  const onAddExtra = async () => {
    if (!exName.trim()) { toast.show(t('extra.need_name', 'Vui lòng nhập tên món'), 'error'); return; }
    const day = await addExtra({
      name: exName.trim(),
      calories: parseMacro(exKcal),
      protein: parseMacro(exP),
      fat: parseMacro(exF),
      carbs: parseMacro(exC),
    });
    setDayIntake({ ...day });
    resetExtra();
    toast.show(t('extra.added', 'Đã thêm vào hôm nay!'), 'success');
  };

  const onEstimateAI = async () => {
    if (!exName.trim()) { toast.show(t('extra.need_name', 'Vui lòng nhập tên món'), 'error'); return; }
    setEstimating(true);
    try {
      const res = await ScheduleAPI.estimateFood(exName.trim());
      if (res?.success && res.food) {
        const fd = res.food;
        if (fd.food) setExName(fd.food);
        setExKcal(fd.calories != null ? String(Math.round(fd.calories)) : '');
        setExP(String(Math.round(parseMacro(fd.protein)) || ''));
        setExF(String(Math.round(parseMacro(fd.fat)) || ''));
        setExC(String(Math.round(parseMacro(fd.carbs)) || ''));
      } else {
        toast.show(res?.error || t('toast.estimate_fail', 'Không ước tính được'), 'error');
      }
    } catch (e) {
      toast.show(e.message || t('toast.estimate_net_err', 'Lỗi kết nối khi ước tính'), 'error');
    } finally { setEstimating(false); }
  };

  const onAnalyzePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('m.perm_title', 'Cần quyền truy cập'), t('m.perm_lib', 'Calorie AI cần quyền truy cập ảnh.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType ? ['images'] : ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setAnalyzing(true);
    try {
      const data = await FoodAPI.analyzePhoto(result.assets[0].uri, exName.trim());
      if (data?.success && data.food) {
        const fd = data.food;
        if (fd.food) setExName(fd.food);
        setExKcal(fd.calories != null ? String(Math.round(fd.calories)) : '');
        setExP(String(Math.round(parseMacro(fd.protein)) || ''));
        setExF(String(Math.round(parseMacro(fd.fat)) || ''));
        setExC(String(Math.round(parseMacro(fd.carbs)) || ''));
        toast.show(t('extra.photo_done', 'Đã phân tích ảnh! Kiểm tra lại số liệu nhé.'), 'success');
      } else if (data?.notFood) {
        toast.show(data.error || t('extra.not_food', 'Ảnh không giống món ăn. Hãy thử ảnh khác.'), 'error');
      } else {
        toast.show(data?.error || t('extra.photo_fail', 'Không phân tích được ảnh'), 'error');
      }
    } catch (e) {
      toast.show(e.message || t('extra.photo_fail', 'Không phân tích được ảnh'), 'error');
    } finally { setAnalyzing(false); }
  };

  const onRemoveExtra = async (id) => {
    const day = await removeExtra(id);
    setDayIntake({ ...day });
  };

  if (loading || checking) {
    return (
      <SafeAreaView style={styles.centerView}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.textSub }}>
          {generating ? t('m.gen_plan', 'AI đang lên thực đơn 7 ngày cho bạn…') : t('m.loading', 'Đang tải…')}
        </Text>
      </SafeAreaView>
    );
  }

  // group plan theo ngày để render
  const byDay = {};
  flatPlan.forEach((m) => {
    const d = m.day || 1;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(m);
  });
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  const DAYS_FULL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

  const totals = computeTotals(dayIntake, flatPlan);
  const consumed = Math.round(totals.calories);
  const tgt = target.calories || 0;
  const diff = tgt - consumed;
  const ringPct = tgt > 0 ? Math.min(1, consumed / tgt) : 0;
  const C = 2 * Math.PI * 52;

  const macroBar = (val, t2) => (t2 > 0 ? Math.min(100, (val / t2) * 100) : 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load({ silent: true }); }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <SectionTitle sub={t('sch.hero_desc', 'AI lên lịch 7 ngày dựa trên mục tiêu của bạn')}>
            {t('sch.hero_title', 'Lộ trình thực đơn của bạn')}
          </SectionTitle>
          <ReminderBell />
        </View>

        {expired ? (
          <Card style={styles.congrat}>
            <Ionicons name="trophy" size={40} color="#D4A017" />
            <Text style={styles.congratTitle}>{t('plan.congrat_title', 'Chúc mừng bạn!')}</Text>
            <Text style={styles.congratBody}>
              {t('plan.congrat_body', 'Bạn đã hoàn thành xuất sắc chặng đường dinh dưỡng. Hãy cập nhật lại chỉ số mới để AI thiết kế lộ trình tiếp theo nhé!')}
            </Text>
            <Button
              title={t('plan.congrat_btn', 'Tiếp tục chặng đường mới')}
              onPress={() => navigation?.navigate?.('Profile')}
              style={{ marginTop: 14, alignSelf: 'stretch' }}
            />
          </Card>
        ) : (
          <>
            {/* ── HÔM NAY ĐÃ NẠP ── */}
            <Card>
              <View style={styles.tiHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tiTitle}>
                    <Ionicons name="flash" size={16} color={colors.primary} /> {t('today.title', 'Hôm nay bạn đã nạp')}
                  </Text>
                  <Text style={styles.tiSub}>{t('today.subtitle', 'Tổng năng lượng & dinh dưỡng đã ăn trong ngày')}</Text>
                </View>
                <View style={styles.ring}>
                  <Svg width={92} height={92} viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="52" stroke="#EEF2EE" strokeWidth="12" fill="none" />
                    <Circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke={diff < 0 ? colors.danger : colors.primary}
                      strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={`${C}`} strokeDashoffset={`${C * (1 - ringPct)}`}
                      originX="60" originY="60" rotation={-90}
                    />
                  </Svg>
                  <View style={styles.ringCenter}>
                    <Text style={styles.ringNum}>{consumed.toLocaleString()}</Text>
                    <Text style={styles.ringSub}>{tgt.toLocaleString()} {t('common.kcal', 'kcal')}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>{t('today.consumed', 'Đã nạp')}</Text>
                  <Text style={styles.chipVal}>{consumed.toLocaleString()} {t('common.kcal', 'kcal')}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>{t('today.target', 'Mục tiêu')}</Text>
                  <Text style={styles.chipVal}>{tgt.toLocaleString()} {t('common.kcal', 'kcal')}</Text>
                </View>
                <View style={[styles.chip, diff < 0 && { backgroundColor: '#FDECEA' }]}>
                  <Text style={styles.chipLabel}>{diff >= 0 ? t('today.remaining', 'Còn lại') : t('today.over', 'Vượt mức')}</Text>
                  <Text style={[styles.chipVal, diff < 0 && { color: colors.danger }]}>
                    {Math.abs(diff).toLocaleString()} {t('common.kcal', 'kcal')}
                  </Text>
                </View>
              </View>

              {/* macro bars */}
              <View style={{ gap: 8, marginTop: 12 }}>
                <MacroLine label="P" val={totals.protein} tgt={target.macros.protein} color="#5b9cf6" pct={macroBar(totals.protein, target.macros.protein)} />
                <MacroLine label="F" val={totals.fat} tgt={target.macros.fat} color="#f5a623" pct={macroBar(totals.fat, target.macros.fat)} />
                <MacroLine label="C" val={totals.carbs} tgt={target.macros.carbs} color="#7dc976" pct={macroBar(totals.carbs, target.macros.carbs)} />
              </View>

              {totals.count === 0 && (
                <Text style={styles.tiEmpty}>{t('today.no_meal', 'Bạn chưa đánh dấu bữa nào hôm nay. Tick "Đã ăn" ở từng bữa để theo dõi.')}</Text>
              )}
            </Card>

            {/* ── THÊM MÓN NGOÀI THỰC ĐƠN ── */}
            <Card>
              <Pressable style={styles.extraToggle} onPress={() => setExtraOpen((v) => !v)}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.extraToggleText}>{t('extra.add_btn', 'Thêm món ăn ngoài thực đơn')}</Text>
                <Ionicons name={extraOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSub} />
              </Pressable>

              {extraOpen && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <Text style={styles.extraDesc}>{t('extra.desc', 'Ăn vặt, trái cây, đồ uống… ngoài thực đơn? Thêm vào đây để tính vào tổng hôm nay.')}</Text>
                  <TextInput
                    value={exName} onChangeText={setExName}
                    placeholder={t('extra.name_ph', 'VD: Táo, sữa chua, trà sữa...')}
                    placeholderTextColor={colors.muted} style={styles.input}
                  />
                  <View style={styles.aiBtnRow}>
                    <Pressable onPress={onEstimateAI} disabled={estimating} style={[styles.aiBtn, estimating && { opacity: 0.6 }]}>
                      {estimating
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Ionicons name="sparkles" size={15} color={colors.primary} />}
                      <Text style={styles.aiBtnText}>{estimating ? t('extra.estimating', 'AI đang ước tính...') : t('extra.estimate', 'Tự động tính bằng AI')}</Text>
                    </Pressable>
                    <Pressable onPress={onAnalyzePhoto} disabled={analyzing} style={[styles.aiBtn, analyzing && { opacity: 0.6 }]}>
                      {analyzing
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Ionicons name="camera" size={15} color={colors.primary} />}
                      <Text style={styles.aiBtnText}>{analyzing ? t('extra.analyzing_photo', 'AI đang phân tích ảnh...') : t('extra.upload_photo', 'Tải ảnh món ăn')}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.macroInputRow}>
                    <SmallInput label={t('extra.kcal', 'kcal')} value={exKcal} onChangeText={setExKcal} />
                    <SmallInput label="P (g)" value={exP} onChangeText={setExP} />
                    <SmallInput label="F (g)" value={exF} onChangeText={setExF} />
                    <SmallInput label="C (g)" value={exC} onChangeText={setExC} />
                  </View>
                  <Button title={t('common.add', 'Thêm')} onPress={onAddExtra} icon={<Ionicons name="add" size={16} color="#fff" />} />
                </View>
              )}

              {(dayIntake.extras || []).length > 0 && (
                <View style={{ marginTop: 14, gap: 8 }}>
                  <Text style={styles.extraListTitle}>{t('extra.list_title', 'Món thêm hôm nay')}</Text>
                  {dayIntake.extras.map((ex) => (
                    <View key={ex.id} style={styles.extraItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.extraItemName}>{ex.name}</Text>
                        <Text style={styles.extraItemMacro}>
                          P {Math.round(parseMacro(ex.protein))}g · F {Math.round(parseMacro(ex.fat))}g · C {Math.round(parseMacro(ex.carbs))}g
                        </Text>
                      </View>
                      <Text style={styles.extraItemKcal}>{Math.round(parseMacro(ex.calories)).toLocaleString()} {t('common.kcal', 'kcal')}</Text>
                      <Pressable onPress={() => onRemoveExtra(ex.id)} hitSlop={8}>
                        <Ionicons name="close" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* ── THỰC ĐƠN 7 NGÀY ── */}
            <View style={styles.weekHeader}>
              <SectionTitle sub={t('m.regen', 'Tạo mới')}>{t('sch.week_title', 'Lộ trình thực đơn 7 ngày')}</SectionTitle>
              <Button
                title={t('m.regen', 'Tạo mới')} variant="secondary" onPress={regenerate} loading={generating}
                icon={<Ionicons name="sparkles" size={16} color={colors.primary} />} style={styles.regenBtn}
              />
            </View>

            {days.length === 0 ? (
              <View style={styles.emptyContainer}><Text style={styles.emptyText}>{t('m.no_plan', 'Chưa có thực đơn tuần này.')}</Text></View>
            ) : (
              days.map((d) => {
                const isToday = d === pday;
                const meals = byDay[d].slice().sort((a, b) => (MEAL_ORDER[a.meal] ?? 9) - (MEAL_ORDER[b.meal] ?? 9));
                return (
                  <Card key={d} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                    <View style={styles.dayHeader}>
                      <View style={[styles.dayDot, isToday && { backgroundColor: colors.primaryDark }]}>
                        <Text style={styles.dayDotText}>{d}</Text>
                      </View>
                      <Text style={styles.dayTitle}>{DAYS_FULL[d - 1] || `Ngày ${d}`}</Text>
                      {isToday && <View style={styles.todayTag}><Text style={styles.todayTagText}>{t('common.today', 'Hôm nay')}</Text></View>}
                    </View>

                    {meals.map((m, j) => {
                      const key = `${pday}-${m.meal}`;
                      const skipped = isToday && !!dayIntake.skipped?.[key];
                      const eaten = isToday && !skipped && !!dayIntake.eaten?.[key];
                      return (
                        <Pressable key={j} style={styles.mealRow} onPress={() => setModalItem({ item: m, isToday, skipped })}>
                          <View style={styles.mealInfo}>
                            <View style={styles.mealTop}>
                              <View style={[
                                styles.timeChip,
                                m.meal === 'Sáng' && { backgroundColor: '#FEF3C7' },
                                m.meal === 'Trưa' && { backgroundColor: '#DBEAFE' },
                                m.meal === 'Tối' && { backgroundColor: '#FCE7F3' },
                                m.meal === 'Phụ' && { backgroundColor: '#E0F2FE' },
                              ]}>
                                <Text style={styles.timeText}>{m.meal}</Text>
                              </View>
                              <Text style={styles.kcalText}>{m.calories} {t('common.kcal', 'kcal')}</Text>
                            </View>
                            <Text style={[styles.foodName, (eaten || skipped) && { textDecorationLine: 'line-through', color: colors.muted }]}>
                              {localizeFood(m.food)}
                            </Text>
                            <Text style={styles.amountText}>{t('m.amount', 'Định lượng')}: {m.amount}</Text>
                            <View style={styles.macroRow}>
                              <Text style={styles.macroText}>P: {m.protein}</Text>
                              <Text style={styles.macroText}>F: {m.fat}</Text>
                              <Text style={styles.macroText}>C: {m.carbs}</Text>
                            </View>
                          </View>

                          {/* trạng thái hôm nay */}
                          {isToday && (
                            skipped ? (
                              <View style={styles.skipBadge}>
                                <Ionicons name="ban" size={12} color={colors.danger} />
                                <Text style={styles.skipBadgeText}>{t('sch.skipped_badge', 'Đã bỏ bữa')}</Text>
                              </View>
                            ) : (
                              <Pressable
                                onPress={(e) => { e.stopPropagation?.(); onToggleEaten(m); }}
                                style={[styles.eatenCheck, eaten && styles.eatenCheckOn]}
                              >
                                <Ionicons name={eaten ? 'checkmark' : 'ellipse-outline'} size={13} color={eaten ? '#fff' : colors.muted} />
                                <Text style={[styles.eatenText, eaten && { color: '#fff' }]}>{t('sch.eaten', 'Đã ăn')}</Text>
                              </Pressable>
                            )
                          )}
                        </Pressable>
                      );
                    })}
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <MealDetailModal
        visible={!!modalItem}
        item={modalItem?.item}
        isToday={modalItem?.isToday}
        skipped={modalItem?.skipped}
        onClose={() => setModalItem(null)}
        onEat={onEat}
        onSkip={onSkip}
        onChange={onChangeMeal}
        onAskAI={onAskAI}
      />
    </SafeAreaView>
  );
}

function MacroLine({ label, val, tgt, color, pct }) {
  return (
    <View>
      <View style={styles.macroLineTop}>
        <Text style={[styles.macroLineLabel, { color }]}>{label}</Text>
        <Text style={styles.macroLineVal}>{Math.round(val)} / {Math.round(tgt)}g</Text>
      </View>
      <View style={styles.macroLineTrack}>
        <View style={{ width: `${pct}%`, backgroundColor: color, height: '100%', borderRadius: 4 }} />
      </View>
    </View>
  );
}

function SmallInput({ label, value, onChangeText }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} keyboardType="numeric"
        placeholder="0" placeholderTextColor={colors.muted} style={styles.smallInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  /* today intake */
  tiHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tiTitle: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  tiSub: { fontSize: 12, color: colors.textSub, marginTop: 3 },
  ring: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNum: { fontSize: 18, fontWeight: '800', color: colors.textMain },
  ringSub: { fontSize: 10, color: colors.textSub },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  chip: { flex: 1, backgroundColor: '#F7FAF7', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center' },
  chipLabel: { fontSize: 11, color: colors.textSub, fontWeight: '600' },
  chipVal: { fontSize: 13, fontWeight: '800', color: colors.textMain, marginTop: 2 },
  tiEmpty: { fontSize: 12.5, color: colors.muted, marginTop: 12, lineHeight: 18 },
  macroLineTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLineLabel: { fontSize: 12, fontWeight: '800' },
  macroLineVal: { fontSize: 12, color: colors.textSub, fontWeight: '600' },
  macroLineTrack: { height: 8, borderRadius: 4, backgroundColor: '#F0F0F0', overflow: 'hidden' },

  /* extra food */
  extraToggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  extraToggleText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textMain },
  extraDesc: { fontSize: 12.5, color: colors.textSub, lineHeight: 18 },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eee', borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 13, fontSize: 15, color: colors.textMain,
  },
  aiBtnRow: { flexDirection: 'row', gap: 10 },
  aiBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 10,
  },
  aiBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  macroInputRow: { flexDirection: 'row', gap: 8 },
  smallLabel: { fontSize: 11, color: colors.textSub, fontWeight: '600', marginBottom: 4 },
  smallInput: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eee', borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 8, fontSize: 14, color: colors.textMain, textAlign: 'center',
  },
  extraListTitle: { fontSize: 13, fontWeight: '800', color: colors.textMain },
  extraItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9FBF9', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: colors.border,
  },
  extraItemName: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  extraItemMacro: { fontSize: 11, color: colors.muted, marginTop: 1 },
  extraItemKcal: { fontSize: 13, fontWeight: '800', color: colors.primary },

  /* week */
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  regenBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  dayCard: { padding: 16 },
  dayCardToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dayDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  dayDotText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  dayTitle: { fontSize: 18, fontWeight: '800', color: colors.textMain, flex: 1 },
  todayTag: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  todayTagText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  mealRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealInfo: { gap: 4, flex: 1 },
  mealTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  timeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, minWidth: 56, alignItems: 'center' },
  timeText: { fontSize: 12, fontWeight: '800', color: '#444' },
  kcalText: { fontSize: 14, color: colors.primary, fontWeight: '800' },
  foodName: { fontSize: 15, fontWeight: '600', color: colors.textMain, lineHeight: 20 },
  amountText: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  macroRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  macroText: { fontSize: 11, color: '#666', fontWeight: '500' },
  eatenCheck: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5,
  },
  eatenCheckOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  eatenText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  skipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FDECEA', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5,
  },
  skipBadgeText: { fontSize: 11, fontWeight: '700', color: colors.danger },

  /* congrats */
  congrat: { alignItems: 'center', padding: 24 },
  congratTitle: { fontSize: 20, fontWeight: '800', color: colors.textMain, marginTop: 12 },
  congratBody: { fontSize: 14, color: colors.textSub, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: colors.muted },
});
