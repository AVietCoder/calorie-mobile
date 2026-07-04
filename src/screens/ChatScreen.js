import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet,
  Text, TextInput, View, Image, Animated, ScrollView, Modal, Alert, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ChatAPI, ScheduleAPI } from '../api/client';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import Markdown from '../components/Markdown';
import { colors, radius } from '../theme/colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImageManipulator from 'expo-image-manipulator'; // cần cài thêm

// Voice input (Web Speech API trên web) — module native, require phòng hờ để app
// không crash khi chạy Expo Go / build cũ chưa có native module.
let Speech = null;
try { Speech = require('expo-speech-recognition'); } catch {}

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
  const { t } = useI18n();
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
  // Web gửi giá trị input date dạng YYYY-MM-DD cho backend (resolveDayIndex đọc ISO).
  const formatDateValue = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };
  // value: gửi backend (giữ tiếng Việt); labelKey: hiển thị theo ngôn ngữ.
  const mealOptions = [
    { value: 'Sáng', labelKey: 'meal.breakfast', fb: 'Sáng' },
    { value: 'Trưa', labelKey: 'meal.lunch', fb: 'Trưa' },
    { value: 'Tối', labelKey: 'meal.dinner', fb: 'Tối' },
    { value: 'Bữa phụ', labelKey: 'meal.snack', fb: 'Bữa phụ' },
  ];

  return (
    <View style={styles.mealCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.mealTitle}>{t('meal.confirm_title', 'Xác nhận bữa ăn của bạn')}</Text>
      </View>

      <Text style={[styles.mealLabel, { marginTop: 12 }]}>{t('meal.choose_time', 'Chọn buổi ăn')}</Text>
      <View style={styles.mealGrid}>
        {mealOptions.map(opt => (
          <Pressable key={opt.value}
            style={[styles.mealChip, mealTime === opt.value && styles.mealChipActive]}
            onPress={() => setMealTime(opt.value)}>
            <Text style={[styles.mealChipText, mealTime === opt.value && styles.mealChipTextActive]}>{t(opt.labelKey, opt.fb)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.mealLabel, { marginTop: 14 }]}>{t('meal.when', 'Thời điểm')}</Text>
      <View style={styles.mealGrid}>
        <Pressable
          style={[styles.mealChip, dayMode === 'today' && styles.mealChipActive]}
          onPress={() => setDayMode('today')}>
          <Text style={[styles.mealChipText, dayMode === 'today' && styles.mealChipTextActive]}>{t('meal.today', 'Hôm nay')}</Text>
        </Pressable>

        <Pressable
          style={[styles.mealChip, dayMode === 'other' && styles.mealChipActive]}
          onPress={() => setDayMode('other')}>
          <Text style={[styles.mealChipText, dayMode === 'other' && styles.mealChipTextActive]}>{t('meal.other_day', 'Ngày khác')}</Text>
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
          onPress={() => mealTime && onConfirm(mealTime, dayMode, dayMode === 'today' ? 'today' : formatDateValue(date))}
          disabled={!mealTime}>
          <Ionicons name="checkmark" size={15} color="#fff" />
          <Text style={styles.mealConfirmText}>{t('meal.confirm', 'Xác nhận')}</Text>
        </Pressable>
              <Pressable style={styles.mealCancelBtn} onPress={onCancel}>
          <Text style={styles.mealCancelText}>{t('meal.cancel', 'Hủy')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Nutrition Sidebar (collapsible card) ────────────────── */
function NutritionSidebar({ data, imageUri, description, onClose }) {
  const { t } = useI18n();
  if (!data) return null;
  const stats = [
    { label: t('chart.protein', 'Protein'), value: data.protein || '--' },
    { label: t('chart.fats', 'Chất béo'), value: data.fat || '--' },
    { label: t('chart.carbs', 'Carbs'), value: data.carbs || '--' },
    { label: t('nut.fiber', 'Chất xơ'), value: data.fiber || '--' },
    { label: t('nut.sugar', 'Đường'), value: data.sugar || '--' },
    { label: t('nut.sodium', 'Natri'), value: data.sodium || '--' },
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
          <Text style={styles.calorieTitle}>{t('chat.total_energy', 'TỔNG NĂNG LƯỢNG').toUpperCase()}</Text>
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
        <Text style={styles.sidebarCloseText}>{t('m.hide_info', 'Ẩn thông tin')}</Text>
      </Pressable>
    </FadeIn>
  );
}

/* ─── Main Screen ─────────────────────────────────────────── */
import { useAuthGuard } from '../hooks/useAuthGuard';

export default function ChatScreen({ navigation, route }) {
  const { checking } = useAuthGuard();
  const { t, tn, lang } = useI18n();

  const toast = useToast();
  const [messages, setMessages] = useState([
    { id: 'sys-1', role: 'assistant', text: t('m.greeting', 'Chào bạn! Hãy gửi tin nhắn hoặc ảnh món ăn, tôi sẽ phân tích giúp bạn.') },
  ]);
  const [input, setInput] = useState('');

  // Nhận "prefill" khi điều hướng từ màn Kế hoạch ("Hỏi HLV AI")
  useEffect(() => {
    const pf = route?.params?.prefill;
    if (pf) {
      setInput(pf);
      navigation?.setParams?.({ prefill: undefined });
    }
  }, [route?.params?.prefill]); // eslint-disable-line

  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [nutritionImage, setNutritionImage] = useState(null);
  const [nutritionDesc, setNutritionDesc] = useState('');
  const [pendingNutrition, setPendingNutrition] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef(null);

  // Lỗi #5 (web): nhớ các ảnh đã phân tích trong phiên (so sánh base64 như web
  // sessionPhotos) để không phân tích lại cùng một tấm ảnh khi không có chỉnh sửa.
  const sessionPhotosRef = useRef([]);
  const pendingB64Ref = useRef(null);

  // ── Voice input (port từ web chat.js — Web Speech API) ──
  const [isRecording, setIsRecording] = useState(false);
  const voiceSubsRef = useRef([]);

  const _clearVoiceSubs = () => {
    voiceSubsRef.current.forEach((s) => { try { s.remove(); } catch {} });
    voiceSubsRef.current = [];
  };

  // Dừng engine nhận giọng, thoát trạng thái recording — GIỮ text trong input (giống web)
  const stopVoice = useCallback(() => {
    setIsRecording(false);
    _clearVoiceSubs();
    try { Speech?.ExpoSpeechRecognitionModule?.stop(); } catch {}
  }, []);

  // Nút X: xóa text và thoát (giống web cancelVoice)
  const cancelVoice = useCallback(() => { stopVoice(); setInput(''); }, [stopVoice]);
  // Nút ✓: chỉ thoát recording, giữ nguyên text để user tự gửi (giống web confirmVoice)
  const confirmVoice = useCallback(() => { stopVoice(); }, [stopVoice]);

  const startVoice = useCallback(async () => {
    const mod = Speech?.ExpoSpeechRecognitionModule;
    if (!mod) {
      toast.show(t('chat.voice_unsupported', 'Thiết bị của bạn không hỗ trợ nhận giọng nói.'), 'error');
      return;
    }
    try {
      const perm = await mod.requestPermissionsAsync();
      if (!perm.granted) {
        toast.show(t('chat.voice_denied', 'Vui lòng cấp quyền microphone.'), 'error');
        return;
      }
      _clearVoiceSubs();
      voiceSubsRef.current.push(
        mod.addListener('result', (e) => {
          const transcript = (e.results || []).map((r) => r.transcript).join('');
          setInput(transcript);
          // Kết quả final: dừng ghi âm nhưng GIỮ text, không tự gửi (giống web)
          if (e.isFinal) stopVoice();
        }),
      );
      voiceSubsRef.current.push(
        mod.addListener('error', (e) => {
          stopVoice();
          const msgs = {
            'not-allowed': t('chat.voice_denied', 'Vui lòng cấp quyền microphone.'),
            'no-speech': t('chat.voice_nospeech', 'Không nghe thấy gì, thử lại nhé.'),
            network: t('chat.voice_neterr', 'Lỗi mạng khi nhận giọng nói.'),
          };
          toast.show(msgs[e.error] || ('Lỗi: ' + e.error), 'error');
        }),
      );
      voiceSubsRef.current.push(
        mod.addListener('end', () => { setIsRecording(false); }),
      );
      mod.start({
        lang: lang === 'en' ? 'en-US' : 'vi-VN',
        interimResults: true,
        continuous: false,
      });
      setIsRecording(true);
    } catch (e) {
      stopVoice();
      toast.show('Lỗi: ' + (e?.message || e), 'error');
    }
  }, [lang, stopVoice, toast, t]);

  // Nút mic: bắt đầu ghi âm (bấm khi đang ghi = confirmVoice — giống web toggleVoice)
  const toggleVoice = useCallback(() => {
    if (isRecording) { confirmVoice(); return; }
    startVoice();
  }, [isRecording, confirmVoice, startVoice]);

  // Đổi ngôn ngữ giữa chừng → dừng recording (giống web lắng nghe 'langchange')
  useEffect(() => { if (isRecording) confirmVoice(); }, [lang]); // eslint-disable-line
  useEffect(() => () => stopVoice(), []); // eslint-disable-line — cleanup khi unmount

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
        <Text style={{ marginTop: 12, color: colors.textSub }}>{t('m.auth_checking', 'Đang xác thực...')}</Text>
      </SafeAreaView>
    );
  }

  // Helper: nén ảnh trước khi gửi — scale về ~2 triệu pixel (giữ tỷ lệ), JPEG chất
  // lượng cao. Khớp thông số optimizeImageFile() của web (targetPixels=2097152, q=0.9).
  // Tham số CỐ ĐỊNH → cùng ảnh gốc luôn encode ra cùng bytes → AI lặp lại được;
  // 2MP đủ chi tiết để ĐẾM vật thể nhỏ (nhiều miếng sushi/bánh).
  // Trả về { uri, base64 } — base64 dùng để nhận diện "gửi lại cùng tấm ảnh" (Lỗi #5).
const compressImage = async (uri, width, height, targetPixels = 2097152, quality = 0.9) => {
  try {
    const actions = [];
    if (width && height) {
      const scale = Math.min(1, Math.sqrt(targetPixels / (width * height)));
      actions.push({ resize: { width: Math.max(1, Math.round(width * scale)) } });
    } else {
      actions.push({ resize: { width: 1024 } }); // fallback khi không biết kích thước gốc
    }
    const result = await ImageManipulator.manipulateAsync(
      uri, actions,
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return { uri: result.uri, base64: result.base64 || null };
  } catch {
    return { uri, base64: null }; // fallback nếu lỗi
  }
};

// Helper: xin quyền + xử lý từ chối tử tế
const ensurePermission = async (kind /* 'library' | 'camera' */) => {
  const ask = kind === 'camera'
    ? ImagePicker.requestCameraPermissionsAsync
    : ImagePicker.requestMediaLibraryPermissionsAsync;
  const get = kind === 'camera'
    ? ImagePicker.getCameraPermissionsAsync
    : ImagePicker.getMediaLibraryPermissionsAsync;

  let perm = await get();
  if (perm.status === 'granted') return true;
  if (perm.canAskAgain) perm = await ask();
  if (perm.status === 'granted') return true;

  // Bị từ chối vĩnh viễn → mời mở Cài đặt
  Alert.alert(
    t('m.perm_title', 'Cần quyền truy cập'),
    kind === 'camera'
      ? t('m.perm_cam', 'Calorie AI cần quyền dùng camera để chụp món ăn.')
      : t('m.perm_lib', 'Calorie AI cần quyền truy cập ảnh để bạn chọn món ăn cần phân tích.'),
    [
      { text: t('m.later', 'Để sau'), style: 'cancel' },
      { text: t('m.open_settings', 'Mở Cài đặt'), onPress: () => Linking.openSettings() },
    ],
  );
  return false;
};

const launchPicker = async (source) => {
  const ok = await ensurePermission(source === 'camera' ? 'camera' : 'library');
  if (!ok) return;

  const opts = {
    mediaTypes: ImagePicker.MediaType ? ['images'] : ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    allowsEditing: false,
  };

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(opts)
    : await ImagePicker.launchImageLibraryAsync(opts);

  if (result.canceled || !result.assets?.[0]) return;
  const asset = result.assets[0];
  const compressed = await compressImage(asset.uri, asset.width, asset.height);
  setPendingImage(compressed.uri);
  pendingB64Ref.current = compressed.base64;
  setInput((v) => v || t('chat.analyze_image', 'Phân tích hình ảnh này'));
};

// Thay thế hàm pickImage cũ
const pickImage = () => {
  Alert.alert(
    t('m.add_photo_title', 'Thêm ảnh món ăn'),
    t('m.add_photo_q', 'Bạn muốn lấy ảnh từ đâu?'),
    [
      { text: t('m.take_photo', 'Chụp ảnh'), onPress: () => launchPicker('camera') },
      { text: t('m.pick_library', 'Chọn từ thư viện'), onPress: () => launchPicker('library') },
      { text: t('m.cancel', 'Huỷ'), style: 'cancel' },
    ],
    { cancelable: true },
  );
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
    if (isRecording) confirmVoice();

    const imgUri = pendingImage;
    const imgB64 = imgUri ? pendingB64Ref.current : null;
    // Món đang hiển thị ở thẻ — dùng làm lastClientMeal cho backend recall "món gần nhất"
    const lastMeal = nutritionData;

    setMessages(s => [...s, { id: `u-${Date.now()}`, role: 'user', text: text || '', imageUri: imgUri }]);
    setInput('');
    setPendingImage(null);
    pendingB64Ref.current = null;

    // Trạng thái gửi lại đúng tấm ảnh vừa được phân tích (Lỗi #5 web).
    const resendSamePhoto = !!(imgUri && imgB64 && sessionPhotosRef.current.includes(imgB64));
    // "Text mặc định" = người dùng không nhập mô tả/chỉnh sửa thật (chỉ bấm gửi ảnh).
    // So với CẢ 2 ngôn ngữ — text mặc định giờ theo ngôn ngữ giao diện
    const isDefaultPrompt = !text || text === 'Phân tích hình ảnh này' || text === 'Analyze this image';

    // ── Lỗi #5: gửi lại đúng ảnh vừa phân tích mà KHÔNG kèm chỉnh sửa
    //    → KHÔNG phân tích lại; chỉ nhắc lại kết quả cũ + hiển thị lại thẻ dinh dưỡng.
    if (resendSamePhoto && isDefaultPrompt && lastMeal) {
      const nm = lastMeal.description || 'món ăn';
      const replyText = lang === 'en'
        ? `I already analyzed this photo — it's **${nm}**. Its nutrition is still shown in the nutrition card. If it looks wrong, type a correction and resend the photo and I'll re-analyze it.`
        : `Mình vừa phân tích tấm ảnh này rồi nè: **${nm}**. Thông tin dinh dưỡng vẫn đang hiển thị ở thẻ dinh dưỡng. Nếu chưa đúng, bạn nhập mô tả/chỉnh sửa rồi gửi lại ảnh để mình phân tích lại nhé!`;
      setMessages(s => [...s, { id: `a-${Date.now()}`, role: 'assistant', text: replyText }]);
      setShowSidebar(true);
      scrollToEnd();
      return;
    }

    // ── Lỗi #4: bắt đầu một lượt phân tích MỚI → xóa số liệu cũ ở thẻ để không
    //    hiển thị nhầm món trước đó khi món mới không tự cập nhật thẻ.
    setNutritionData(null);
    setNutritionDesc('');
    setNutritionImage(null);
    setSending(true);

    try {
      // Gửi ảnh khi: ảnh mới; HOẶC gửi lại ảnh cũ nhưng CÓ kèm chỉnh sửa/mô tả;
      // HOẶC gửi lại ảnh cũ nhưng chưa có dữ liệu cache (fallback: phân tích lại) — giống web.
      let res;
      if (imgUri && (!resendSamePhoto || !isDefaultPrompt || !lastMeal)) {
        // reanalyze=true CHỈ khi gửi lại đúng ảnh cũ kèm chỉnh sửa — server mới bơm
        // ngữ cảnh hội thoại vào vision; ảnh MỚI luôn phân tích với context sạch.
        res = await ChatAPI.sendWithImage(text, imgUri, lastMeal, lang, resendSamePhoto && !isDefaultPrompt);
      } else {
        res = await ChatAPI.send(text, lastMeal, lang);
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
        // Nhớ ảnh đã phân tích thành công trong phiên (Lỗi #5)
        if (imgUri && imgB64 && !sessionPhotosRef.current.includes(imgB64)) {
          sessionPhotosRef.current.push(imgB64);
        }
      }
    } catch (e) {
      toast.show(e.message || t('m.send_err', 'Lỗi gửi tin'), 'error');
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const handleMealConfirm = async (mealTime, dayMode, dayValue) => {
    setMessages(s => s.filter(m => m.type !== 'meal_selection'));
    // Nhãn HIỂN THỊ theo ngôn ngữ hiện tại (giống web submitMealUpdate);
    // giá trị GỬI backend giữ tiếng Việt để backend nhận đúng ngày/bữa.
    const mealLabelMap = {
      'Sáng': t('meal.breakfast', 'Sáng'), 'Trưa': t('meal.lunch', 'Trưa'),
      'Tối': t('meal.dinner', 'Tối'), 'Bữa phụ': t('meal.snack', 'Bữa phụ'),
    };
    const shownTime = mealLabelMap[mealTime] || mealTime;
    const shownDate = dayValue === 'today' ? t('meal.today', 'Hôm nay') : dayValue;
    const confirmText = tn('meal.confirm_sent', { meal: shownTime, day: shownDate },
      `Xác nhận: Ăn vào buổi ${shownTime}, ${shownDate}`);
    setMessages(s => [...s, { id: `u-mc-${Date.now()}`, role: 'user', text: confirmText }]);
    setSending(true);
    try {
      const res = await ChatAPI.sendMealUpdate(confirmText, pendingNutrition, mealTime, dayValue, lang);
      if (res?.success) {
        const reply = res?.reply || t('meal.logged', 'Đã ghi lại bữa ăn của bạn!');
        setMessages(s => [...s, { id: `a-mc-${Date.now()}`, role: 'assistant', text: cleanReply(reply) }]);
        // Đồng bộ thực đơn mới do backend tái cân bằng -> màn Kế hoạch cập nhật ngay.
        if (Array.isArray(res?.newPlan) && res.newPlan.length) {
          try { await ScheduleAPI.setCached(res.newPlan); } catch {}
        }
        toast.show(t('meal.updated_toast', 'Đã cập nhật thời khóa biểu & thống kê!'), 'success');
      } else {
        setMessages(s => [...s, {
          id: `a-mc-${Date.now()}`, role: 'assistant',
          text: cleanReply(res?.reply || res?.error || t('meal.update_fail', 'Mình chưa cập nhật được, bạn thử lại nhé.')),
        }]);
      }
    } catch (e) {
      toast.show(e.message || t('meal.conn_err', 'Lỗi kết nối server'), 'error');
    } finally {
      setSending(false);
      setPendingNutrition(null);
      scrollToEnd();
    }
  };

  const handleMealCancel = () => {
    setMessages(s => s.filter(m => m.type !== 'meal_selection'));
    setMessages(s => [...s, { id: `a-cancel-${Date.now()}`, role: 'assistant', text: t('meal.cancelled', 'Đã hủy. Bạn có thể nhập món khác.') }]);
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
            isUser
              ? <Text style={[styles.text, { color: '#fff' }]}>{item.text}</Text>
              : <Markdown text={item.text} color={colors.textMain} />
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
        <Text style={styles.headerSub}>{t('m.online', '● Đang trực tuyến')}</Text>
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
              <Text style={styles.loadingText}>{t('common.loading', 'Đang tải lịch sử trò chuyện...')}</Text>
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
            <Text style={styles.previewLabel}>{t('m.img_ready', 'Ảnh sẵn sàng phân tích')}</Text>
            <Pressable onPress={() => { setPendingImage(null); pendingB64Ref.current = null; setInput(''); }}>
              <Ionicons name="close-circle" size={22} color={colors.primary} />
            </Pressable>
          </View>
        )}

        <View style={[styles.inputWrap, isRecording && styles.inputWrapRecording]}>
          <Pressable onPress={pickImage} style={styles.uploadBtn} disabled={sending}>
            <Ionicons name="image" size={20} color={colors.primary} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={sending
              ? t('m.analyzing', 'AI đang phân tích...')
              : t('m.chat_ph', 'Nhập món ăn hoặc câu hỏi…')}
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            editable={!sending}
            onSubmitEditing={send}
          />
          {isRecording ? (
            <>
              {/* Nút X — hủy (xóa text), giống web cancelVoice */}
              <Pressable onPress={cancelVoice} style={[styles.voiceBtn, styles.voiceCancelBtn]}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
              {/* Nút ✓ — giữ text, giống web confirmVoice */}
              <Pressable onPress={confirmVoice} style={[styles.voiceBtn, styles.voiceConfirmBtn]}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={toggleVoice} style={styles.voiceBtn} disabled={sending}>
                <Ionicons name="mic" size={18} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={send}
                style={[styles.sendBtn, (!input.trim() && !pendingImage) && { opacity: 0.5 }]}
                disabled={(!input.trim() && !pendingImage) || sending}>
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            </>
          )}
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
  voiceBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primarySoft || '#E8F2EC',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceCancelBtn: { backgroundColor: colors.danger },
  voiceConfirmBtn: { backgroundColor: colors.primary },
  inputWrapRecording: { borderColor: colors.primary, borderWidth: 1.5 },

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
