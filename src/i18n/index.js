// src/i18n/index.js
// Đa ngôn ngữ (VI/EN) cho mobile — port từ web public/i18n.js.
// Dùng React Context để mọi screen tự render lại khi đổi ngôn ngữ.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DICT } from './dict';

const LS_KEY = 'calorie_ai_lang';
const DEFAULT_LANG = 'vi';

/* Một vài chuỗi chỉ có ở mobile (web không có) — gộp thêm vào từ điển gốc. */
const EXTRA = {
  vi: {
    'm.auth_checking': 'Đang xác thực...',
    'm.loading': 'Đang tải…',
    'm.gen_plan': 'AI đang lên thực đơn 7 ngày cho bạn…',
    'm.online': '● Đang trực tuyến',
    'm.chat_ph': 'Nhập món ăn hoặc câu hỏi…',
    'm.img_ready': 'Ảnh sẵn sàng phân tích',
    'm.hide_info': 'Ẩn thông tin',
    'm.add_photo_title': 'Thêm ảnh món ăn',
    'm.add_photo_q': 'Bạn muốn lấy ảnh từ đâu?',
    'm.take_photo': 'Chụp ảnh',
    'm.from_library': 'Chọn từ thư viện',
    'm.cancel': 'Huỷ',
    'm.later': 'Để sau',
    'm.open_settings': 'Mở Cài đặt',
    'm.perm_title': 'Cần quyền truy cập',
    'm.perm_cam': 'Calorie AI cần quyền dùng camera để chụp món ăn.',
    'm.perm_lib': 'Calorie AI cần quyền truy cập ảnh để bạn chọn món ăn cần phân tích.',
    'm.add_photo_title': 'Thêm ảnh món ăn',
    'm.add_photo_q': 'Bạn muốn lấy ảnh từ đâu?',
    'm.take_photo': 'Chụp ảnh',
    'm.pick_library': 'Chọn từ thư viện',
    'chat.analyze_image': 'Phân tích hình ảnh này',
    'chat.voice_unsupported': 'Thiết bị của bạn không hỗ trợ nhận giọng nói.',
    'chat.voice_denied': 'Vui lòng cấp quyền microphone.',
    'chat.voice_nospeech': 'Không nghe thấy gì, thử lại nhé.',
    'chat.voice_neterr': 'Lỗi mạng khi nhận giọng nói.',
    'm.greeting': 'Chào bạn! Hãy gửi tin nhắn hoặc ảnh món ăn, tôi sẽ phân tích giúp bạn.',
    'm.meal_confirm_title': 'Xác nhận bữa ăn của bạn',
    'm.pick_meal': 'Chọn buổi ăn',
    'm.when': 'Thời điểm',
    'm.other_day': 'Ngày khác',
    'm.confirm': 'Xác nhận',
    'm.canceled': 'Đã hủy. Bạn có thể nhập món khác nhé!',
    'm.logged_meal': 'Đã ghi lại bữa ăn của bạn!',
    'm.send_err': 'Lỗi gửi tin',
    'm.update_err': 'Lỗi cập nhật',
    'm.login_required': 'Vui lòng đăng nhập!',
    'm.login_ok': 'Đăng nhập thành công!',
    'm.login_fail': 'Đăng nhập thất bại',
    'm.fill_all': 'Vui lòng nhập đủ thông tin',
    'm.reg_ok': 'Đăng ký thành công! Hãy đăng nhập.',
    'm.reg_fail': 'Đăng ký thất bại',
    'm.amount': 'Định lượng',
    'm.no_plan': 'Chưa có thực đơn tuần này.',
    'm.plan_valid': 'Plan tuần này vẫn còn hiệu lực, chưa cần tạo mới',
    'm.plan_new': 'Đã tạo kế hoạch mới',
    'm.plan_made': 'Đã tạo thực đơn cho bạn',
    'm.plan_err': 'Lỗi tạo kế hoạch',
    'm.regen': 'Tạo mới',
    'm.confirm_logout': 'Bạn chắc chắn muốn đăng xuất?',
    'm.done': 'Hoàn tất!',
    'm.have_error': 'Có lỗi xảy ra',
    'm.guide_title': 'Hướng dẫn sử dụng',
    'm.guide_sub': 'Mọi thứ bạn cần biết để dùng Calorie AI hiệu quả',
    'm.faq': 'Câu hỏi thường gặp',
    'm.welcome_back': 'Chào mừng trở lại 👋',
    'm.add_extra_more': 'Bạn muốn thêm món gì khác không?',
    'm.search_nearby_hint': 'Mở Google Maps tìm quán gần bạn',
    'm.del': 'Xóa',
    'm.tab_diet': 'Dinh dưỡng', 'm.tab_chat': 'Hỏi đáp', 'm.tab_plan': 'Kế hoạch', 'm.tab_guide': 'Cẩm nang', 'm.tab_profile': 'Hồ sơ',
    'm.g_start_b': 'Đăng ký tài khoản → Hoàn tất Hồ sơ (cân nặng, chiều cao, mục tiêu) → Vào tab Dinh dưỡng để xem chỉ số.',
    'm.g_diet_b': 'Xem TDEE, BMR, tỷ lệ Protein/Carbs/Fat, tiến độ cân nặng và biểu đồ calo theo từng ngày trong tuần.',
    'm.g_chat_b': 'Mô tả món ăn bạn vừa ăn (vd: "trưa nay ăn 1 tô phở bò") để AI ước lượng calo và macro tự động.',
    'm.g_plan_b': 'AI Coach gợi ý thực đơn 7 ngày. Tick "Đã ăn", đổi món, bỏ bữa, thêm món ngoài thực đơn và theo dõi tổng nạp hôm nay.',
    'm.g_rem_t': 'Nhắc nhở',
    'm.g_rem_b': 'Bấm chuông trên đầu trang Dinh dưỡng/Kế hoạch để đặt nhắc giờ ăn & uống thuốc. App sẽ rung và hiện chuông báo khi tới giờ.',
    'm.g_tips_b': 'Nhập món ăn ngay sau khi ăn, kéo xuống để refresh dữ liệu, đăng nhập lại nếu phiên hết hạn.',
    'm.faq1_q': 'Tôi có cần kết nối API riêng không?',
    'm.faq1_a': 'Không. App tự dùng URL prod khi build production và localhost khi dev.',
    'm.faq2_q': 'Nhắc nhở có chạy khi tắt app không?',
    'm.faq2_a': 'Nhắc nhở kêu khi app đang mở (giống bản web). Hãy mở app để nhận nhắc đúng giờ.',
    'm.faq3_q': 'Làm sao reset dữ liệu?',
    'm.faq3_a': 'Vào Hồ sơ → Đăng xuất, sau đó đăng nhập lại.',
    'm.analyzing': 'AI đang phân tích...',
    'm.dont_close': 'Vui lòng không đóng ứng dụng…',
    'extra.detected': 'Nhận diện',
    'extra.filled_note': 'Đã điền vào form — nhấn Thêm để lưu',
    'extra.low_conf': 'Giá trị chỉ mang tính ước lượng.',
    'diary.title': 'Nhật ký ảnh món ăn',
    'diary.sub': 'Những món bạn đã chụp và phân tích gần đây.',
    'toast.reload_plan': 'Đang tải lại lộ trình mới...',
    'diet.energy_overview': 'Tổng quan năng lượng',
    /* thống kê 7 ngày + cảnh báo sức khỏe (đồng bộ web) */
    'week.title': 'Thống kê 7 ngày gần nhất',
    'week.sub': 'Các chất đã nạp mỗi ngày so với mức khuyến nghị',
    'week.chart_title': 'Chất dinh dưỡng đã nạp vs khuyến nghị',
    'week.no_data': 'Chưa có dữ liệu — hãy tick "Đã ăn" ở trang Kế hoạch để hệ thống thống kê.',
    'week.health_title': 'Cảnh báo sức khỏe 7 ngày',
    'week.health_desc': 'AI phân tích hành vi ăn uống 7 ngày gần nhất, dự đoán xu hướng tình trạng bệnh và đưa lời khuyên.',
    'week.analyze': 'Phân tích bằng AI',
    'week.analyzing': 'AI đang phân tích...',
    'week.advice': 'Lời khuyên',
    'week.status_good': 'Đang cải thiện tốt',
    'week.status_stable': 'Duy trì ổn định',
    'week.status_risk': 'Có nguy cơ xấu đi',
  },
  en: {
    'm.auth_checking': 'Verifying...',
    'm.loading': 'Loading…',
    'm.gen_plan': 'AI is building your 7-day menu…',
    'm.online': '● Online',
    'm.chat_ph': 'Type a food or a question…',
    'm.img_ready': 'Image ready to analyze',
    'm.hide_info': 'Hide info',
    'm.add_photo_title': 'Add a food photo',
    'm.add_photo_q': 'Where do you want the photo from?',
    'm.take_photo': 'Take a photo',
    'm.from_library': 'Choose from library',
    'm.cancel': 'Cancel',
    'm.later': 'Later',
    'm.open_settings': 'Open Settings',
    'm.perm_title': 'Permission required',
    'm.perm_cam': 'Calorie AI needs camera access to take a photo of your food.',
    'm.perm_lib': 'Calorie AI needs photo access so you can pick a dish to analyze.',
    'm.add_photo_title': 'Add a food photo',
    'm.add_photo_q': 'Where would you like the photo from?',
    'm.take_photo': 'Take a photo',
    'm.pick_library': 'Choose from library',
    'chat.analyze_image': 'Analyze this image',
    'chat.voice_unsupported': "Your device doesn't support voice input.",
    'chat.voice_denied': 'Please allow microphone access.',
    'chat.voice_nospeech': "I didn't hear anything — try again.",
    'chat.voice_neterr': 'Network error during voice recognition.',
    'm.greeting': "Hi! Send a message or a food photo and I'll analyze it for you.",
    'm.meal_confirm_title': 'Confirm your meal',
    'm.pick_meal': 'Pick a meal time',
    'm.when': 'When',
    'm.other_day': 'Another day',
    'm.confirm': 'Confirm',
    'm.canceled': 'Cancelled. You can enter another dish.',
    'm.logged_meal': 'Your meal has been logged!',
    'm.send_err': 'Failed to send',
    'm.update_err': 'Update error',
    'm.login_required': 'Please sign in!',
    'm.login_ok': 'Signed in!',
    'm.login_fail': 'Sign in failed',
    'm.fill_all': 'Please fill in all fields',
    'm.reg_ok': 'Registered! Please sign in.',
    'm.reg_fail': 'Registration failed',
    'm.amount': 'Amount',
    'm.no_plan': 'No menu for this week yet.',
    'm.plan_valid': "This week's plan is still valid, no need to regenerate",
    'm.plan_new': 'New plan created',
    'm.plan_made': 'Your menu is ready',
    'm.plan_err': 'Failed to create plan',
    'm.regen': 'Regenerate',
    'm.confirm_logout': 'Are you sure you want to sign out?',
    'm.done': 'Done!',
    'm.have_error': 'Something went wrong',
    'm.guide_title': 'User guide',
    'm.guide_sub': 'Everything you need to use Calorie AI effectively',
    'm.faq': 'Frequently asked questions',
    'm.welcome_back': 'Welcome back 👋',
    'm.add_extra_more': 'Want to add another item?',
    'm.search_nearby_hint': 'Open Google Maps to find places near you',
    'm.del': 'Delete',
    'm.tab_diet': 'Nutrition', 'm.tab_chat': 'Chat', 'm.tab_plan': 'Plan', 'm.tab_guide': 'Guide', 'm.tab_profile': 'Profile',
    'm.g_start_b': 'Register → Complete your Profile (weight, height, goal) → Open the Nutrition tab to see your stats.',
    'm.g_diet_b': 'See TDEE, BMR, the Protein/Carbs/Fat ratio, weight progress and a daily calorie chart for the week.',
    'm.g_chat_b': 'Describe what you just ate (e.g. "1 bowl of beef pho for lunch") and the AI estimates calories and macros automatically.',
    'm.g_plan_b': 'The AI coach suggests a 7-day menu. Mark meals eaten, swap dishes, skip meals, add off-plan foods and track today\'s intake.',
    'm.g_rem_t': 'Reminders',
    'm.g_rem_b': 'Tap the bell on the Nutrition/Plan header to set meal & medication reminders. The app vibrates and pops an alarm when it\'s time.',
    'm.g_tips_b': 'Log food right after eating, pull down to refresh, and sign in again if your session expires.',
    'm.faq1_q': 'Do I need to connect my own API?',
    'm.faq1_a': 'No. The app uses the prod URL in production builds and localhost in dev.',
    'm.faq2_q': 'Do reminders fire when the app is closed?',
    'm.faq2_a': 'Reminders fire while the app is open (same as the web). Keep the app open to get them on time.',
    'm.faq3_q': 'How do I reset my data?',
    'm.faq3_a': 'Go to Profile → Sign out, then sign in again.',
    'm.analyzing': 'AI is analyzing...',
    'm.dont_close': "Please don't close the app…",
    'extra.detected': 'Detected',
    'extra.filled_note': 'Filled into the form — tap Add to save',
    'extra.low_conf': 'Values are rough estimates only.',
    'diary.title': 'Food photo diary',
    'diary.sub': "Dishes you've recently photographed and analyzed.",
    'toast.reload_plan': 'Reloading your new plan...',
    'diet.energy_overview': 'Energy overview',
    /* 7-day stats + health warning (synced with web) */
    'week.title': 'Last 7 days overview',
    'week.sub': 'Daily nutrient intake vs recommendations',
    'week.chart_title': 'Nutrients eaten vs recommended',
    'week.no_data': 'No data yet — tick "Eaten" on the Plan page so the system can track your intake.',
    'week.health_title': '7-day health warning',
    'week.health_desc': 'AI analyzes your eating behavior over the last 7 days, predicts your health trend and gives advice.',
    'week.analyze': 'Analyze with AI',
    'week.analyzing': 'AI is analyzing...',
    'week.advice': 'Advice',
    'week.status_good': 'Improving well',
    'week.status_stable': 'Staying stable',
    'week.status_risk': 'At risk of getting worse',
  },
};

const TABLE = {
  vi: { ...DICT.vi, ...EXTRA.vi },
  en: { ...DICT.en, ...EXTRA.en },
};

/* TÊN BỆNH: giá trị trong DB -> khoá i18n (để hiển thị đúng ngôn ngữ). */
const DISEASE_KEY_BY_VALUE = {
  gout: 'disease.gout',
  'tiểu đường': 'disease.diabetes', 'tieu duong': 'disease.diabetes', diabetes: 'disease.diabetes',
  'huyết áp cao': 'disease.hypertension', 'cao huyết áp': 'disease.hypertension',
  'huyet ap cao': 'disease.hypertension', 'high blood pressure': 'disease.hypertension', hypertension: 'disease.hypertension',
  'mỡ máu cao': 'disease.high_cholesterol', 'mo mau cao': 'disease.high_cholesterol', 'high cholesterol': 'disease.high_cholesterol',
  'gan nhiễm mỡ': 'disease.fatty_liver', 'gan nhiem mo': 'disease.fatty_liver', 'fatty liver': 'disease.fatty_liver',
  'bệnh dạ dày': 'disease.stomach', 'đau dạ dày': 'disease.stomach', 'benh da day': 'disease.stomach', stomach: 'disease.stomach',
  'bệnh thận': 'disease.kidney', 'benh than': 'disease.kidney', kidney: 'disease.kidney', 'kidney disease': 'disease.kidney',
  'khác': 'disease.other', khac: 'disease.other', other: 'disease.other',
};

const FOOD_EN = {
  'phở': 'Pho', 'phở bò': 'Beef pho', 'phở gà': 'Chicken pho',
  'bún bò': 'Beef noodle soup (bun bo)', 'bún bò huế': 'Hue beef noodle soup',
  'bún chả': 'Grilled pork & noodles (bun cha)', 'bún riêu': 'Crab noodle soup (bun rieu)',
  'bún thịt nướng': 'Grilled pork vermicelli', 'bún': 'Rice vermicelli',
  'cơm': 'Rice', 'cơm trắng': 'Steamed white rice', 'cơm tấm': 'Broken rice with grilled pork',
  'cơm gà': 'Chicken rice', 'cơm sườn': 'Rice with pork chop',
  'bánh mì': 'Banh mi (Vietnamese baguette)', 'bánh mì trứng': 'Egg banh mi',
  'gỏi cuốn': 'Fresh spring rolls', 'chả giò': 'Fried spring rolls', 'nem rán': 'Fried spring rolls',
  'hủ tiếu': 'Hu tieu noodle soup', 'mì': 'Noodles', 'mì xào': 'Stir-fried noodles', 'miến': 'Glass noodles',
  'cháo': 'Rice porridge', 'cháo gà': 'Chicken congee', 'cháo trắng': 'Plain rice porridge',
  'canh': 'Soup', 'canh chua': 'Sour soup', 'canh rau': 'Vegetable soup',
  'rau luộc': 'Boiled vegetables', 'rau muống xào': 'Stir-fried water spinach', 'rau xào': 'Stir-fried vegetables',
  'trứng': 'Eggs', 'trứng luộc': 'Boiled eggs', 'trứng chiên': 'Fried eggs', 'trứng ốp la': 'Fried eggs (sunny-side up)',
  'ức gà': 'Chicken breast', 'thịt gà': 'Chicken', 'gà luộc': 'Boiled chicken',
  'thịt bò': 'Beef', 'bò xào': 'Stir-fried beef', 'thịt heo': 'Pork', 'thịt lợn': 'Pork',
  'cá': 'Fish', 'cá hấp': 'Steamed fish', 'cá kho': 'Braised fish', 'cá chiên': 'Fried fish',
  'tôm': 'Shrimp', 'tôm hấp': 'Steamed shrimp',
  'đậu hũ': 'Tofu', 'đậu phụ': 'Tofu', 'đậu hũ sốt cà': 'Tofu in tomato sauce',
  'sữa chua': 'Yogurt', 'sữa chua không đường': 'Unsweetened yogurt',
  'sinh tố': 'Smoothie', 'yến mạch': 'Oatmeal', salad: 'Salad',
  'trái cây': 'Fruit', 'chuối': 'Banana', 'táo': 'Apple', cam: 'Orange', 'ổi': 'Guava',
  'trà sữa': 'Bubble milk tea', 'nước ép': 'Juice',
};

const I18nContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LS_KEY);
        if (saved === 'en' || saved === 'vi') setLangState(saved);
      } catch {}
    })();
  }, []);

  const setLang = useCallback(async (l) => {
    const next = l === 'en' || l === 'vi' ? l : DEFAULT_LANG;
    setLangState(next);
    try { await AsyncStorage.setItem(LS_KEY, next); } catch {}
  }, []);

  const t = useCallback((key, fallback) => {
    const table = TABLE[lang] || TABLE[DEFAULT_LANG];
    if (table && key in table) return table[key];
    if (TABLE[DEFAULT_LANG] && key in TABLE[DEFAULT_LANG]) return TABLE[DEFAULT_LANG][key];
    return fallback != null ? fallback : key;
  }, [lang]);

  const tn = useCallback((key, vars, fallback) => {
    let s = t(key, fallback);
    if (vars && typeof s === 'string') {
      Object.keys(vars).forEach((k) => {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  }, [t]);

  const localizeDisease = useCallback((value) => {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    const k = DISEASE_KEY_BY_VALUE[raw.toLowerCase()];
    return k ? t(k, raw) : raw;
  }, [t]);

  const localizeFood = useCallback((name) => {
    const raw = String(name || '').trim();
    if (!raw || lang !== 'en') return raw;
    const key = raw.toLowerCase().replace(/\s+/g, ' ');
    if (FOOD_EN[key]) return FOOD_EN[key];
    const base = key.replace(/\(.*?\)/g, '').trim();
    if (FOOD_EN[base]) return FOOD_EN[base];
    return raw;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tn, localizeDisease, localizeFood }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  // Fallback an toàn nếu component vô tình nằm ngoài Provider
  if (!ctx) {
    const t = (k, fb) => (TABLE[DEFAULT_LANG][k] != null ? TABLE[DEFAULT_LANG][k] : (fb != null ? fb : k));
    return { lang: DEFAULT_LANG, setLang: () => {}, t, tn: t, localizeDisease: (v) => v, localizeFood: (v) => v };
  }
  return ctx;
}
