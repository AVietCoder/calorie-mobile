// GuideScreen — Cẩm nang sử dụng, port nội dung từ web public/guide.html:
// Giới thiệu + 4 tính năng, Bắt đầu nhanh (4 bước), Setup, Dashboard, Chat AI,
// Lịch 7 ngày, Mẹo (có nút điều hướng như web), FAQ 4 câu.
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../theme/colors';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useI18n } from '../i18n';
import { LangSwitch } from '../components/HeaderWidgets';

// Một số chuỗi web chứa thẻ HTML (<strong>...) — bỏ thẻ khi hiển thị trên mobile.
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '');

export default function GuideScreen({ navigation }) {
  const { checking } = useAuthGuard();
  const { t } = useI18n();
  const [open, setOpen] = useState(null);

  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.textSub }}>{t('m.auth_checking', 'Đang xác thực...')}</Text>
      </SafeAreaView>
    );
  }

  const FEATURES = [
    { icon: 'flash', t1: t('guide.feat_auto_t', 'Phân tích tự động'), d: t('guide.feat_auto_d', '') },
    { icon: 'chatbubbles', t1: t('guide.feat_coach_t', 'HLV AI'), d: t('guide.feat_coach_d', '') },
    { icon: 'calendar', t1: t('guide.feat_plan_t', 'Lịch 7 ngày'), d: t('guide.feat_plan_d', '') },
    { icon: 'trending-up', t1: t('guide.feat_progress_t', 'Theo dõi tiến độ'), d: t('guide.feat_progress_d', '') },
  ];

  const START_STEPS = [
    { t1: t('guide.start_s1_t', ''), d: t('guide.start_s1_d', '') },
    { t1: t('guide.start_s2_t', ''), d: t('guide.start_s2_d', '') },
    { t1: t('guide.start_s3_t', ''), d: t('guide.start_s3_d', '') },
    { t1: t('guide.start_s4_t', ''), d: t('guide.start_s4_d', '') },
  ];

  const SETUP_LIS = [
    t('guide.setup_li1', ''), t('guide.setup_li2', ''),
    t('guide.setup_li3', ''), t('guide.setup_li4', ''),
  ];

  const DASH_ITEMS = [
    { t1: t('guide.dash_macro_t', ''), d: t('guide.dash_macro_d', '') },
    { t1: t('guide.dash_weight_t', ''), d: t('guide.dash_weight_d', '') },
    { t1: t('guide.dash_cal_t', ''), d: t('guide.dash_cal_d', '') },
    { t1: t('guide.dash_bmr_t', ''), d: t('guide.dash_bmr_d', '') },
  ];

  const CHAT_QS = [
    t('guide.chat_q1', ''), t('guide.chat_q2', ''),
    t('guide.chat_q3', ''), t('guide.chat_q4', ''),
  ];

  const PLAN_LIS = [
    t('guide.plan_li1', ''), t('guide.plan_li2', ''), t('guide.plan_li3', ''),
  ];

  // Mẹo có nút điều hướng (web: "Mở Diet / Mở Chat / Mở Plan / Mở Setup")
  const TIPS = [
    { icon: 'pie-chart', t1: t('guide.tips_dash_t', ''), d: t('guide.tips_dash_d', ''), go: t('guide.tips_dash_go', 'Mở Diet'), tab: 'Diet' },
    { icon: 'chatbubbles', t1: t('guide.tips_chat_t', ''), d: t('guide.tips_chat_d', ''), go: t('guide.tips_chat_go', 'Mở Chat'), tab: 'Chat' },
    { icon: 'calendar', t1: t('guide.tips_plan_t', ''), d: t('guide.tips_plan_d', ''), go: t('guide.tips_plan_go', 'Mở Plan'), tab: 'Schedule' },
    { icon: 'person', t1: t('guide.tips_setup_t', ''), d: t('guide.tips_setup_d', ''), go: t('guide.tips_setup_go', 'Mở Setup'), tab: 'Profile' },
  ];

  const FAQS = [
    { q: t('guide.faq_q1', ''), a: t('guide.faq_a1', '') },
    { q: t('guide.faq_q2', ''), a: t('guide.faq_a2', '') },
    { q: t('guide.faq_q3', ''), a: t('guide.faq_a3', '') },
    { q: t('guide.faq_q4', ''), a: t('guide.faq_a4', '') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{t('guide.intro_title', 'Calorie AI là gì?')}</Text>
            <Text style={styles.sub}>{stripHtml(t('guide.intro_desc', ''))}</Text>
          </View>
          <LangSwitch />
        </View>

        {/* 4 tính năng nổi bật */}
        <View style={styles.featGrid}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featCard}>
              <View style={styles.iconBox}><Ionicons name={f.icon} size={20} color={colors.primary} /></View>
              <Text style={styles.featTitle}>{f.t1}</Text>
              <Text style={styles.featDesc}>{stripHtml(f.d)}</Text>
            </View>
          ))}
        </View>

        {/* Bắt đầu nhanh — 4 bước */}
        <SectionCard icon="rocket" title={t('guide.start_title', 'Bắt đầu nhanh')} lead={stripHtml(t('guide.start_lead', ''))}>
          {START_STEPS.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{stripHtml(s.t1)}</Text>
                <Text style={styles.stepDesc}>{stripHtml(s.d)}</Text>
              </View>
            </View>
          ))}
        </SectionCard>

        {/* Setup lộ trình */}
        <SectionCard icon="person" title={t('guide.setup_title', 'Thiết lập hồ sơ')} lead={stripHtml(t('guide.setup_lead', ''))}>
          <Text style={styles.blockLabel}>{t('guide.setup_fields_h', 'Các thông tin quan trọng')}</Text>
          {SETUP_LIS.map((li, i) => (
            <Bullet key={i} text={stripHtml(li)} />
          ))}
          <NoteBox icon="bulb" color="#B8975A" label={t('guide.label_tip', 'Mẹo')} body={stripHtml(t('guide.setup_tip_body', ''))} />
        </SectionCard>

        {/* Dashboard Diet */}
        <SectionCard icon="pie-chart" title={t('guide.dash_title', 'Dashboard Diet')} lead={stripHtml(t('guide.dash_lead', ''))}>
          {DASH_ITEMS.map((d, i) => (
            <View key={i} style={styles.dashItem}>
              <Text style={styles.stepTitle}>{stripHtml(d.t1)}</Text>
              <Text style={styles.stepDesc}>{stripHtml(d.d)}</Text>
            </View>
          ))}
          <NoteBox icon="warning" color={colors.warning} label={t('guide.label_note', 'Lưu ý')} body={stripHtml(t('guide.dash_warn_body', ''))} />
        </SectionCard>

        {/* Chat AI */}
        <SectionCard icon="chatbubbles" title={t('guide.chat_title', 'Trò chuyện với HLV AI')} lead={stripHtml(t('guide.chat_lead', ''))}>
          <Text style={styles.blockLabel}>{t('guide.chat_ask_h', 'Bạn có thể hỏi gì?')}</Text>
          {CHAT_QS.map((q, i) => (
            <Bullet key={i} text={stripHtml(q)} />
          ))}
          <NoteBox icon="information-circle" color={colors.info} label={t('guide.label_note', 'Lưu ý')} body={stripHtml(t('guide.chat_note_body', ''))} />
        </SectionCard>

        {/* Lịch 7 ngày */}
        <SectionCard icon="calendar" title={t('guide.plan_title', 'Lịch thực đơn 7 ngày')} lead={stripHtml(t('guide.plan_lead', ''))}>
          {PLAN_LIS.map((li, i) => (
            <Bullet key={i} text={stripHtml(li)} />
          ))}
        </SectionCard>

        {/* Nhắc nhở (tính năng có trên cả 2 nền tảng) */}
        <SectionCard icon="notifications" title={t('m.g_rem_t', 'Nhắc nhở')} lead={t('m.g_rem_b', '')} />

        {/* Mẹo sử dụng — có nút điều hướng như web */}
        <Text style={[styles.h1, { fontSize: 18, marginTop: 4 }]}>{t('guide.tips_title', 'Mẹo dùng hiệu quả')}</Text>
        {TIPS.map((tip, i) => (
          <View key={i} style={styles.tipCard}>
            <View style={styles.iconBox}><Ionicons name={tip.icon} size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{stripHtml(tip.t1)}</Text>
              <Text style={styles.stepDesc}>{stripHtml(tip.d)}</Text>
            </View>
            <Pressable style={styles.goBtn} onPress={() => navigation?.navigate?.(tip.tab)}>
              <Text style={styles.goBtnText}>{stripHtml(tip.go)}</Text>
              <Ionicons name="arrow-forward" size={13} color="#fff" />
            </Pressable>
          </View>
        ))}

        {/* FAQ — 4 câu như web */}
        <Text style={[styles.h1, { fontSize: 18, marginTop: 4 }]}>{t('guide.faq_title', 'Câu hỏi thường gặp')}</Text>
        {FAQS.map((f, i) => (
          <Pressable key={i} onPress={() => setOpen(open === i ? null : i)} style={styles.faq}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.faqQ}>{stripHtml(f.q)}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSub} />
            </View>
            {open === i && <Text style={styles.faqA}>{stripHtml(f.a)}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({ icon, title, lead, children }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <View style={styles.iconBox}><Ionicons name={icon} size={20} color={colors.primary} /></View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {!!lead && <Text style={styles.cardLead}>{lead}</Text>}
      {children}
    </View>
  );
}

function Bullet({ text }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function NoteBox({ icon, color, label, body }) {
  if (!body) return null;
  return (
    <View style={[styles.noteBox, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={styles.noteText}>
        <Text style={{ fontWeight: '800', color }}>{label}: </Text>{body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', color: colors.textMain },
  sub: { color: colors.textSub, marginTop: 4, fontSize: 13, lineHeight: 19 },
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featCard: {
    width: '48%', flexGrow: 1, backgroundColor: '#fff', padding: 14,
    borderRadius: radius.lg, gap: 6,
  },
  featTitle: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  featDesc: { fontSize: 12, color: colors.textSub, lineHeight: 17 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: radius.xl },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textMain, flex: 1 },
  cardLead: { fontSize: 13, color: colors.textSub, lineHeight: 19, marginBottom: 8 },
  iconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  stepRow: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  stepDesc: { fontSize: 12.5, color: colors.textSub, lineHeight: 18, marginTop: 2 },
  blockLabel: {
    fontSize: 12, fontWeight: '800', color: colors.textSub,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6, marginBottom: 4,
  },
  bulletRow: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  bulletDot: { color: colors.primary, fontWeight: '800' },
  bulletText: { flex: 1, fontSize: 13, color: colors.textMain, lineHeight: 19 },
  dashItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  noteBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FBF9F4', borderLeftWidth: 3, borderRadius: 10,
    padding: 11, marginTop: 10,
  },
  noteText: { flex: 1, fontSize: 12.5, color: colors.textMain, lineHeight: 18 },
  tipCard: {
    backgroundColor: '#fff', padding: 14, borderRadius: radius.lg,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  goBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 999,
  },
  goBtnText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  faq: { backgroundColor: '#fff', padding: 14, borderRadius: radius.lg },
  faqQ: { fontSize: 14, fontWeight: '600', color: colors.textMain, flex: 1 },
  faqA: { marginTop: 8, color: colors.textSub, fontSize: 13, lineHeight: 19 },
});
