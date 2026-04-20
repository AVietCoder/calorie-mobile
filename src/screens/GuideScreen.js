import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../theme/colors';
import { useAuthGuard } from '../hooks/useAuthGuard';

const SECTIONS = [
  {
    id: 'start', icon: 'rocket', title: 'Bắt đầu',
    body: 'Đăng ký tài khoản → Hoàn tất Setup (cân nặng, chiều cao, mục tiêu) → Vào tab Diet để xem chỉ số.',
  },
  {
    id: 'diet', icon: 'pie-chart', title: 'Tab Diet — Phân tích',
    body: 'Xem TDEE, BMR, tỷ lệ Protein/Carbs/Fat, tiến độ cân nặng 7 ngày, biểu đồ calo theo từng ngày trong tuần.',
  },
  {
    id: 'chat', icon: 'chatbubbles', title: 'Tab Chat — Trợ lý AI',
    body: 'Mô tả món ăn bạn vừa ăn (vd: "trưa nay ăn 1 tô phở bò") để AI ước lượng calo và macro tự động.',
  },
  {
    id: 'schedule', icon: 'calendar', title: 'Tab Schedule — Kế hoạch tuần',
    body: 'AI Coach gợi ý thực đơn 7 ngày dựa trên mục tiêu của bạn. Bấm "Tạo mới" để regenerate.',
  },
  {
    id: 'tips', icon: 'bulb', title: 'Mẹo dùng hiệu quả',
    body: 'Nhập món ăn ngay sau khi ăn, kéo xuống để refresh dữ liệu, đăng nhập lại nếu token hết hạn.',
  },
];

const FAQS = [
  { q: 'Tôi có cần kết nối API riêng không?', a: 'App tự động dùng URL prod (Vercel) khi build production, dùng localhost khi dev.' },
  { q: 'Token đăng nhập lưu ở đâu?', a: 'AsyncStorage trên thiết bị, tự khôi phục khi mở lại app.' },
  { q: 'Làm sao reset dữ liệu?', a: 'Vào Profile → Đăng xuất, sau đó đăng nhập lại.' },
];

export default function GuideScreen() {
  const { checking } = useAuthGuard();


  const [open, setOpen] = useState(null);
    if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.textSub }}>Đang xác thực...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
        <View>
          <Text style={styles.h1}>Hướng dẫn sử dụng</Text>
          <Text style={styles.sub}>Mọi thứ bạn cần biết để dùng Calorie AI hiệu quả</Text>
        </View>

        {SECTIONS.map((s) => (
          <View key={s.id} style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons name={s.icon} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{s.title}</Text>
              <Text style={styles.cardBody}>{s.body}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.h1, { fontSize: 18, marginTop: 8 }]}>Câu hỏi thường gặp</Text>
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
