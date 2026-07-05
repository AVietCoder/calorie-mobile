// src/agent/intents.js
// "Bộ não" của Trợ lý: phân loại câu nói của người dùng thành một Ý ĐỊNH (intent) có cấu
// trúc. Đây là hàm THUẦN (không side-effect) để dễ kiểm thử; việc THỰC THI (gọi service,
// điều hướng, đặt nhắc…) do AssistantContext đảm nhận với các dependency thật.
//
// Hỗ trợ song ngữ (VI + EN) bằng regex. Trả về { type, params } hoặc null (→ hỏi backend).

// ── Giờ giấc: "3pm" | "15:30" | "3 giờ chiều" | "lúc 8" → "HH:MM" ──
export function parseTime(text) {
  const s = String(text || '').toLowerCase();

  // 24h rõ ràng HH:MM
  let m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) return `${String(+m[1]).padStart(2, '0')}:${m[2]}`;

  // 12h kèm am/pm: "3pm", "3 pm", "3:30 pm"
  m = s.match(/\b(1[0-2]|0?\d)(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  if (m) {
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    const pm = /p/.test(m[3]);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  // Tiếng Việt: "3 giờ chiều", "8 giờ tối", "7 giờ 30 sáng", "10 giờ"
  m = s.match(/\b(\d{1,2})\s*giờ(?:\s*(\d{1,2}))?\s*(sáng|trưa|chiều|tối|đêm)?/);
  if (m) {
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    const period = m[3];
    if (period && period !== 'sáng') { if (h < 12) h += 12; }       // trưa/chiều/tối/đêm
    else if (period === 'sáng' && h === 12) h = 0;
    if (h > 23) h %= 24;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  // "at 3" / "lúc 8" (giờ trần)
  m = s.match(/\b(?:at|lúc)\s+(\d{1,2})\b/);
  if (m) { const h = +m[1]; if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:00`; }

  return null;
}

// Loại nhắc: nước / thuốc / bữa ăn.
function reminderType(s) {
  if (/\b(water|drink)\b/.test(s) || /uống nước|nước/.test(s)) return 'water';
  if (/\b(pill|pills|medicine|medication|meds|vitamin)\b/.test(s) || /uống thuốc|thuốc/.test(s)) return 'med';
  if (/\b(eat|breakfast|lunch|dinner|meal|snack)\b/.test(s) || /\băn\b|bữa/.test(s)) return 'meal';
  return 'meal';
}

// Trích nội dung nhắc: "remind me to <X> at ..." / "nhắc tôi <X> lúc ..."
function reminderLabel(s) {
  let m = s.match(/remind\s+me\s+to\s+(.+?)(?:\s+(?:at|by|around|every)\b.*)?$/i);
  if (m && m[1]) return m[1].trim();
  m = s.match(/remind\s+me\s+(.+?)(?:\s+(?:at|by)\b.*)?$/i);
  if (m && m[1]) return m[1].trim();
  m = s.match(/nhắc(?:\s+(?:tôi|tớ|mình|em))?\s+(.+?)(?:\s+(?:lúc|vào|mỗi)\b.*)?$/i);
  if (m && m[1]) return m[1].trim();
  return '';
}

// Câu nói → tên tab.
function matchTab(s) {
  if (/nutrition|dashboard|\bdiet\b|dinh dưỡng|chỉ số|thống kê/.test(s)) return 'Diet';
  if (/\bplan\b|menu|schedule|kế hoạch|thực đơn|lộ trình|lịch ăn/.test(s)) return 'Schedule';
  if (/\bchat\b|hỏi đáp|trò chuyện/.test(s)) return 'Chat';
  if (/\bguide\b|\bhelp\b|cẩm nang|hướng dẫn/.test(s)) return 'Guide';
  if (/profile|setting|account|hồ sơ|cài đặt|tài khoản/.test(s)) return 'Profile';
  return null;
}

// Câu nói → chất dinh dưỡng cần hỏi.
function matchMetric(s) {
  if (/protein|đạm/.test(s)) return 'protein';
  if (/carb|tinh bột|đường bột/.test(s)) return 'carbs';
  if (/\bfat\b|chất béo|\bbéo\b/.test(s)) return 'fat';
  return 'calories';
}

export function detectIntent(text /*, lang */) {
  const s = String(text || '').toLowerCase().trim();
  if (!s) return null;

  // 1) Đặt nhắc nhở
  if (/\bremind\b|\bnhắc\b/.test(s)) {
    return {
      type: 'set_reminder',
      params: { remType: reminderType(s), time: parseTime(s), label: reminderLabel(s) },
    };
  }

  // 2) Điều hướng (chỉ khi có động từ mở + xác định được tab).
  //    Lưu ý: \b không hoạt động cạnh ký tự có dấu tiếng Việt nên các từ VI không dùng \b.
  if (/\b(open|go to|show|take me to|switch to)\b|mở|vào|xem|chuyển/.test(s)) {
    const tab = matchTab(s);
    if (tab) return { type: 'navigate', params: { tab } };
  }

  // 3) Tạo lại thực đơn
  if (/\b(regenerate|remake)\b/.test(s)
      || /\b(new|create|make)\b.*\b(plan|menu)\b/.test(s)
      || /(tạo|lên)\s+(?:lại\s+)?(?:thực đơn|kế hoạch)|thực đơn mới|kế hoạch mới/.test(s)) {
    return { type: 'regenerate_plan', params: {} };
  }

  // 4) Hỏi số liệu đã nạp hôm nay (phải có từ khoá "còn lại / hôm nay / đã nạp" để KHÔNG
  //    nhầm với câu hỏi dinh dưỡng chung "bao nhiêu calo trong quả chuối").
  if (/(calorie|calo|protein|carb|fat|đạm|béo|tinh bột)/.test(s)
      && /(left|remaining|so far|còn lại|còn bao nhiêu|hôm nay|today|đã nạp)/.test(s)) {
    return { type: 'query_intake', params: { metric: matchMetric(s) } };
  }

  // 5) Sửa hồ sơ: cân nặng mục tiêu / cân nặng hiện tại.
  //    [^0-9]*? LƯỜI để cụm dài "target weight" / "cân nặng mục tiêu" được ưu tiên khớp
  //    thay vì bị nuốt còn mỗi "weight" / "cân nặng".
  const pm = s.match(/(?:set|change|update|đổi|đặt|cập nhật)[^0-9]*?(target weight|goal weight|current weight|weight|cân nặng mục tiêu|cân nặng)[^0-9]*(\d{2,3}(?:\.\d)?)/);
  if (pm) {
    const field = /(target|goal|mục tiêu)/.test(pm[1]) ? 'target_weight' : 'weight';
    return { type: 'profile_set', params: { field, value: Number(pm[2]) } };
  }

  return null;
}
