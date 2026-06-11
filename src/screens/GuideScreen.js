import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../theme/colors';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useI18n } from '../i18n';
import { LangSwitch } from '../components/HeaderWidgets';

export default function GuideScreen() {
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

  const SECTIONS = [
    { id: 'start', icon: 'rocket', title: t('guide.toc_start', 'Bắt đầu'), body: t('m.g_start_b', '') },
    { id: 'diet', icon: 'pie-chart', title: t('guide.toc_dashboard', 'Dashboard Diet'), body: t('m.g_diet_b', '') },
    { id: 'chat', icon: 'chatbubbles', title: t('guide.toc_chat', 'Trò chuyện AI'), body: t('m.g_chat_b', '') },
    { id: 'plan', icon: 'calendar', title: t('guide.toc_plan', 'Lịch 7 ngày'), body: t('m.g_plan_b', '') },
    { id: 'rem', icon: 'notifications', title: t('m.g_rem_t', 'Nhắc nhở'), body: t('m.g_rem_b', '') },
    { id: 'tips', icon: 'bulb', title: t('guide.toc_tips', 'Mẹo & Lưu ý'), body: t('m.g_tips_b', '') },
  ];

  const FAQS = [
    { q: t('m.faq1_q', ''), a: t('m.faq1_a', '') },
    { q: t('m.faq2_q', ''), a: t('m.faq2_a', '') },
    { q: t('m.faq3_q', ''), a: t('m.faq3_a', '') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{t('m.guide_title', 'Hướng dẫn sử dụng')}</Text>
            <Text style={styles.sub}>{t('m.guide_sub', 'Mọi thứ bạn cần biết để dùng Calorie AI hiệu quả')}</Text>
          </View>
          <LangSwitch />
        </View>

        {SECTIONS.map((s) => (
          <View key={s.id} style={styles.card}>
            <View style={styles.iconBox}><Ionicons name={s.icon} size={22} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{s.title}</Text>
              <Text style={styles.cardBody}>{s.body}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.h1, { fontSize: 18, marginTop: 8 }]}>{t('m.faq', 'Câu hỏi thường gặp')}</Text>
        {FAQS.map((f, i) => (
          <Pressable key={i} onPress={() => setOpen(open === i ? null : i)} style={styles.faq}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSub} />
            </View>
            {open === i && <Text style={styles.faqA}>{f.a}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', color: colors.textMain },
  sub: { color: colors.textSub, marginTop: 4 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: radius.xl, flexDirection: 'row', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textMain, marginBottom: 4 },
  cardBody: { fontSize: 14, color: colors.textSub, lineHeight: 20 },
  faq: { backgroundColor: '#fff', padding: 14, borderRadius: radius.lg },
  faqQ: { fontSize: 14, fontWeight: '600', color: colors.textMain, flex: 1 },
  faqA: { marginTop: 8, color: colors.textSub, fontSize: 13, lineHeight: 19 },
});
