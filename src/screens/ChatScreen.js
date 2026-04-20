import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet,
  Text, TextInput, View, Image, Animated, ScrollView, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ChatAPI } from '../api/client';
import { useToast } from '../components/Toast';
import { colors, radius } from '../theme/colors';
import DateTimePicker from '@react-native-community/datetimepicker';

const cleanDisplayContent = (content) => {
  if (!content) return "";
  return String(content)
    .replace(/<message>[\s\S]*?<\/message>/gi, '')
    .replace(/<data>[\s\S]*?<\/data>/gi, '')
    .replace(/<image>[\s\S]*?<\/image>/gi, '')
    .replace(/<error>[\s\S]*?<\/error>/gi, '')
    .replace(/<deleted>[\s\S]*?<deleted>/gi, '')
    .replace(/\n{3,}/g, '\n\n') // Thu gọn khoảng trống thừa
    .trim();
};

/* ─── Typing Dots ─────────────────────────────────────────── */
function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 180),
        Animated.timing(dot, { toValue: -6, duration: 280, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.delay(500),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={[styles.bubble, styles.bot, { flexDirection: 'row', gap: 5, paddingVertical: 14, alignSelf: 'flex-start' }]}>
      {dots.map((dot, i) => (
        <Animated.View key={i}
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: 0.7, transform: [{ translateY: dot }] }}
        />
      ))}
    </View>
  );
}

/* ─── Fade-in wrapper for bubbles ─────────────────────────── */
function FadeIn({ children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

/* ─── Meal Selection Card ─────────────────────────────────── */
function MealSelectionCard({ onConfirm, onCancel }) {
  const [mealTime, setMealTime] = useState(null);
  const [dayMode, setDayMode] = useState('today');
  const [date, setDate] = useState(new Date()); // Lưu giá trị ngày
  const [showPicker, setShowPicker] = useState(false); // Điều khiển hiện/ẩn lịch

  // Hàm xử lý khi chọn ngày xong
  const onDateChange = (event, selectedDate) => {
    // Với Android, khi chọn xong hoặc hủy thì đóng luôn
    setShowPicker(false); 
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatDateLabel = (d) => {
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };
  const [dateValue, setDateValue] = useState('');
  const mealOptions = ['Sáng', 'Trưa', 'Tối', 'Bữa phụ'];

  return (
    <View style={styles.mealCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.mealTitle}>Xác nhận bữa ăn của bạn</Text>
      </View>

      <Text style={[styles.mealLabel, { marginTop: 12 }]}>Chọn buổi ăn</Text>
      <View style={styles.mealGrid}>
        {mealOptions.map(opt => (
          <Pressable key={opt}
            style={[styles.mealChip, mealTime === opt && styles.mealChipActive]}
            onPress={() => setMealTime(opt)}>
            <Text style={[styles.mealChipText, mealTime === opt && styles.mealChipTextActive]}>{opt}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.mealLabel, { marginTop: 14 }]}>Thời điểm</Text>
      <View style={styles.mealGrid}>
        <Pressable 
          style={[styles.mealChip, dayMode === 'today' && styles.mealChipActive]}
          onPress={() => setDayMode('today')}>
          <Text style={[styles.mealChipText, dayMode === 'today' && styles.mealChipTextActive]}>Hôm nay</Text>
        </Pressable>

        <Pressable 
          style={[styles.mealChip, dayMode === 'other' && styles.mealChipActive]}
          onPress={() => setDayMode('other')}>
          <Text style={[styles.mealChipText, dayMode === 'other' && styles.mealChipTextActive]}>Ngày khác</Text>
        </Pressable>
      </View>

      {/* Đây là cái "Input Date" của bro */}
      {dayMode === 'other' && (
        <>
          <Pressable 
            onPress={() => setShowPicker(true)} 
            style={styles.dateInputFake}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.textMain} />
            <Text style={{ color: colors.textMain }}>{formatDateLabel(date)}</Text>
          </Pressable>

          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default" // "calendar" cho Android, "spinner" cho iOS
              onChange={onDateChange}
              maximumDate={new Date()} // Không cho chọn ngày tương lai
            />
          )}
        </>
      )}

       <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Pressable
          style={[styles.mealConfirmBtn, !mealTime && { opacity: 0.45 }]}
          onPress={() => mealTime && onConfirm(mealTime, dayMode, dayMode === 'today' ? 'hôm nay' : dateValue)}
          disabled={!mealTime}>
          <Ionicons name="checkmark" size={15} color="#fff" />
          <Text style={styles.mealConfirmText}>Xác nhận</Text>
        </Pressable>
              <Pressable style={styles.mealCancelBtn} onPress={onCancel}>
          <Text style={styles.mealCancelText}>Hủy</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Nutrition Sidebar (collapsible card) ────────────────── */
function NutritionSidebar({ data, imageUri, description, onClose }) {
  if (!data) return null;
  const stats = [
    { label: 'Protein', value: data.protein || '--' },
    { label: 'Chất béo', value: data.fat || '--' },
    { label: 'Carbs', value: data.carbs || '--' },
    { label: 'Chất xơ', value: data.fiber || '--' },
    { label: 'Đường', value: data.sugar || '--' },
    { label: 'Natri', value: data.sodium || '--' },
  ];
  return (
    <FadeIn style={styles.sidebarWrap}>
      {imageUri && (
        <View style={styles.foodImgContainer}>
          <Image source={{ uri: imageUri }} style={styles.foodImg} resizeMode="cover" />
        </View>
      )}
      <View style={styles.calorieBox}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="flame" size={13} color="#C97D3A" />
          <Text style={styles.calorieTitle}>TỔNG NĂNG LƯỢNG</Text>
        </View>
        <Text style={styles.calorieValue}>{data.calories || 0} kcal</Text>
      </View>

      {!!description && (
        <View style={styles.descBox}>
          <Text style={styles.descText}>{description}</Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        {stats.map(s => (
          <View key={s.label} style={styles.statRow}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statVal}>{s.value}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onClose} style={styles.sidebarClose}>
        <Ionicons name="close" size={16} color={colors.textSub} />
        <Text style={styles.sidebarCloseText}>Ẩn thông tin</Text>
      </Pressable>
    </FadeIn>
  );
}

/* ─── Main Screen ─────────────────────────────────────────── */
import { useAuthGuard } from '../hooks/useAuthGuard';

export default function ChatScreen() {
  const { checking } = useAuthGuard();

  const toast = useToast();
  const [messages, setMessages] = useState([
    { id: 'sys-1', role: 'assistant', text: 'Chào bạn! Hãy gửi tin nhắn hoặc ảnh món ăn, tôi sẽ phân tích giúp bạn.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [nutritionImage, setNutritionImage] = useState(null);
  const [nutritionDesc, setNutritionDesc] = useState('');
  const [pendingNutrition, setPendingNutrition] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const hist = await ChatAPI.history();
        if (Array.isArray(hist) && hist.length) {
          setMessages(hist.map((m, i) => ({
            id: String(i),
            role: m.role || 'assistant',
            text: cleanDisplayContent(m.content || m.text || ''),
          })));
        }
      } catch { /* dùng welcome message mặc định */ }
      finally { setLoadingHistory(false); }
    })();
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.textSub }}>Đang xác thực...</Text>
      </SafeAreaView>
    );
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.show('Cần quyền truy cập thư viện ảnh', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPendingImage(result.assets[0].uri);
      setInput('Phân tích hình ảnh này');
    }
  };

  const extractData = (text = '') => {
    const match = String(text).match(/<data>([\s\S]*?)<\/data>/i);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch { return null; }
  };

  const cleanReply = (text = '') => cleanDisplayContent(text);

  const send = async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || sending) return;

    const imgUri = pendingImage;
    setMessages(s => [...s, { id: `u-${Date.now()}`, role: 'user', text: text || '', imageUri: imgUri }]);
    setInput('');
    setPendingImage(null);
    setSending(true);

    try {
      let res;
      if (imgUri) {
        res = await ChatAPI.sendWithImage(text, imgUri);
      } else {
        res = await ChatAPI.send(text);
      }

      const rawReply = res?.reply || res?.message || res?.content || 'Đã ghi nhận.';
      const display = cleanReply(rawReply);
      const parsed = extractData(rawReply);

      setMessages(s => [...s, { id: `a-${Date.now()}`, role: 'assistant', text: display }]);

      if (parsed) {
        setNutritionData(parsed);
        setNutritionDesc(display);
        if (imgUri) setNutritionImage(imgUri);
        setPendingNutrition(parsed);
        setShowSidebar(true);
        setMessages(s => [...s, { id: `meal-${Date.now()}`, type: 'meal_selection' }]);
      }
    } catch (e) {
      toast.show(e.message || 'Lỗi gửi tin', 'error');
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const handleMealConfirm = async (mealTime, dayMode, dayValue) => {
    setMessages(s => s.filter(m => m.type !== 'meal_selection'));
    const confirmText = `Xác nhận: Ăn vào buổi ${mealTime}, ${dayValue}`;
    setMessages(s => [...s, { id: `u-mc-${Date.now()}`, role: 'user', text: confirmText }]);
    setSending(true);
    try {
      const res = await ChatAPI.sendMealUpdate(confirmText, pendingNutrition, mealTime, dayValue);
      const reply = res?.reply || res?.message || 'Đã ghi lại bữa ăn!';
      setMessages(s => [...s, { id: `a-mc-${Date.now()}`, role: 'assistant', text: cleanReply(reply) }]);
    } catch (e) {
      toast.show(e.message || 'Lỗi cập nhật', 'error');
      setMessages(s => [...s, { id: `a-mc-${Date.now()}`, role: 'assistant', text: 'Đã ghi lại bữa ăn của bạn!' }]);
    } finally {
      setSending(false);
      setPendingNutrition(null);
      scrollToEnd();
    }
  };

  const handleMealCancel = () => {
    setMessages(s => s.filter(m => m.type !== 'meal_selection'));
    setMessages(s => [...s, { id: `a-cancel-${Date.now()}`, role: 'assistant', text: 'Đã hủy. Bạn có thể nhập món khác nhé!' }]);
    setPendingNutrition(null);
  };

  const renderItem = ({ item }) => {
    if (item.type === 'meal_selection') {
      return (
        <FadeIn>
          <MealSelectionCard onConfirm={handleMealConfirm} onCancel={handleMealCancel} />
        </FadeIn>
      );
    }
    const isUser = item.role === 'user';
    return (
      <FadeIn style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
        <View style={[styles.bubble, isUser ? styles.user : styles.bot]}>
          {item.imageUri && (
            <Image source={{ uri: item.imageUri }} style={styles.msgImage} resizeMode="cover" />
          )}
          {!!item.text && (
            <Text style={[styles.text, isUser && { color: '#fff' }]}>{item.text}</Text>
          )}
        </View>
      </FadeIn>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
      <View style={styles.avatar}>
        <MaterialCommunityIcons name="leaf" size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Calorie AI</Text>
        <Text style={styles.headerSub}>● Đang trực tuyến</Text>
      </View>
    </View>

     {/* --- 2. Nút hiện Kcal nằm nép bên phải màn hình --- */}
  {nutritionData && (
    <Pressable 
      style={styles.floatingEdgeBtn} 
      onPress={() => setShowSidebar(true)}
    >
      <Ionicons name="chevron-back" size={14} color="#C97D3A" />
      <Ionicons name="flame" size={16} color="#C97D3A" />
      <Text style={styles.floatingBtnText}>{nutritionData.calories} kcal</Text>
    </Pressable>
  )}

  {/* --- 3. Modal hiện thông tin chi tiết (Popup) --- */}
  <Modal 
    visible={showSidebar} 
    transparent 
    animationType="slide" 
    onRequestClose={() => setShowSidebar(false)}
  >
    <View style={styles.modalOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSidebar(false)} />
      <View style={styles.modalContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <NutritionSidebar
            data={nutritionData}
            imageUri={nutritionImage}
            description={nutritionDesc}
            onClose={() => setShowSidebar(false)}
          />
        </ScrollView>
      </View>
    </View>
  </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}>
        {loadingHistory && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <TypingDots />
              <Text style={styles.loadingText}>Đang tải lịch sử trò chuyện...</Text>
            </View>
          </View>
        )}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          onContentSizeChange={scrollToEnd}
          renderItem={renderItem}
          ListFooterComponent={sending ? <TypingDots /> : null}
        />

        {pendingImage && (
          <View style={styles.previewWrap}>
            <Image source={{ uri: pendingImage }} style={styles.previewImg} resizeMode="cover" />
            <Text style={styles.previewLabel}>Ảnh sẵn sàng phân tích</Text>
            <Pressable onPress={() => { setPendingImage(null); setInput(''); }}>
              <Ionicons name="close-circle" size={22} color={colors.primary} />
            </Pressable>
          </View>
        )}

        <View style={styles.inputWrap}>
          <Pressable onPress={pickImage} style={styles.uploadBtn}>
            <Ionicons name="image" size={20} color={colors.primary} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Nhập món ăn hoặc câu hỏi…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            style={[styles.sendBtn, (!input.trim() && !pendingImage) && { opacity: 0.5 }]}
            disabled={(!input.trim() && !pendingImage) || sending}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  headerSub: { fontSize: 11, color: colors.primary, marginTop: 2 },
  calBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3E2', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: '#F5C842',
  },
  calBadgeText: { fontSize: 12, fontWeight: '700', color: '#C97D3A' },

  /* Sidebar */
  sidebarWrap: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  foodImgContainer: {
    backgroundColor: colors.primary, padding: 5, borderRadius: 16, marginBottom: 14,
  },
  foodImg: { width: '100%', aspectRatio: 16/10, borderRadius: 12 },
  calorieBox: { marginBottom: 12 },
  calorieTitle: { fontSize: 11, fontWeight: '700', color: colors.textSub, letterSpacing: 0.6 },
  calorieValue: { fontSize: 28, fontWeight: '800', color: colors.textMain, marginTop: 4, letterSpacing: -0.5 },
  descBox: {
    backgroundColor: colors.primarySoft || '#E8F2EC',
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    padding: 12, borderRadius: 12, marginBottom: 14,
  },
  descText: { fontSize: 13, lineHeight: 19, color: colors.primaryDark || '#3D7353' },
  statsGrid: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border,
    borderStyle: 'dashed',
  },
  statLabel: { fontSize: 13, color: colors.textSub },
  statVal: { fontSize: 13, fontWeight: '700', color: colors.textMain },
  sidebarClose: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginTop: 12, paddingVertical: 8,
  },
  sidebarCloseText: { fontSize: 12, color: colors.textSub, fontWeight: '600' },

  /* Bubbles */
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  user: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bot: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  text: { fontSize: 14, color: colors.textMain, lineHeight: 21 },
  msgImage: { width: 200, height: 140, borderRadius: 10, marginBottom: 6 },

  /* Meal card */
  mealCard: {
    backgroundColor: colors.cream || '#FBF7EE', borderRadius: 18, padding: 16,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  mealTitle: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  mealLabel: { fontSize: 11, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealChip: {
    flex: 1, minWidth: '45%', paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#fff', alignItems: 'center',
  },
  mealChipActive: { backgroundColor: colors.primarySoft || '#E8F2EC', borderColor: colors.primary },
  mealChipText: { fontSize: 13, fontWeight: '500', color: colors.textMain },
  mealChipTextActive: { color: colors.primaryDark || '#3D7353', fontWeight: '700' },
  dateInput: {
    marginTop: 10, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: colors.textMain, backgroundColor: '#fff',
  },
  mealCancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 12,
    backgroundColor: colors.primarySoft || '#E8F2EC', alignItems: 'center',
  },
  mealCancelText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark || '#3D7353' },
  mealConfirmBtn: {
    flex: 2, paddingVertical: 11, borderRadius: 12,
    backgroundColor: colors.primary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  mealConfirmText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  /* Image preview */
  previewWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginBottom: 6,
    backgroundColor: '#fff', borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  previewImg: { width: 48, height: 48, borderRadius: 8 },
  previewLabel: { flex: 1, fontSize: 12, color: colors.primary, fontWeight: '600' },

  /* Input */
  inputWrap: {
    flexDirection: 'row', gap: 8, padding: 8, paddingLeft: 14,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border,
    alignItems: 'center', borderRadius: 999, margin: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  uploadBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primarySoft || '#E8F2EC',
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, paddingHorizontal: 4, paddingVertical: 8,
    fontSize: 14, maxHeight: 100, color: colors.textMain,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(244,247,244,0.92)',
    alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  loadingBox: {
    backgroundColor: '#fff', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 24,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E9ECEF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  loadingText: { fontSize: 13, color: '#636E72', fontWeight: '600', marginTop: 4 },
  // Nút nép bên phải
  floatingEdgeBtn: {
    position: 'absolute',
    right: 0,
    top: '20%', // Hiển thị ở khoảng 1/5 màn hình từ trên xuống
    backgroundColor: '#FEF3E2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: '#F5C842',
    zIndex: 99,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  floatingBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C97D3A',
  },
  // Lớp nền mờ của Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  dateInputFake: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
});
