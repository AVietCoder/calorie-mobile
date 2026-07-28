// src/agent/classify.js
// BỘ PHÂN LOẠI Ý ĐỊNH dùng CHUNG cho Chat và Trợ lý giọng nói — nguồn chân lý DUY NHẤT để
// quyết định có nên hỏi "ăn vào bữa nào?" hay không. Trước đây logic này bị TÁCH ĐÔI và
// KHÔNG NHẤT QUÁN: ChatScreen hiện thẻ chọn bữa cho MỌI reply có <data> (kể cả khi người
// dùng chỉ XIN GỢI Ý món), còn Trợ lý chỉ dựa vào một regex "đã ăn" mong manh. Kết quả:
// yêu cầu gợi ý/trò chuyện chung vẫn bị hỏi bữa — đúng lỗi cần sửa (Issue 3).
//
// Hàm THUẦN (không side-effect) → test được bằng node. Song ngữ VI/EN bằng regex.
//
// Danh mục:
//   COMMAND      — lệnh điều khiển app (đặt nhắc/điều hướng/tạo thực đơn/hỏi số liệu đã nạp/
//                  sửa hồ sơ). Kèm { action } từ detectIntent để thực thi.
//   LOG_MEAL     — người dùng THỰC SỰ vừa ăn/uống, muốn GHI NHẬN → được phép hỏi bữa.
//   ANALYZE_FOOD — hỏi số liệu dinh dưỡng của một món ("bao nhiêu calo trong chuối").
//   RECOMMEND    — xin GỢI Ý/ĐỀ XUẤT món → KHÔNG BAO GIỜ hỏi bữa.
//   GENERAL      — hội thoại chung.
import { detectIntent } from './intents';

// Tránh \b cạnh ký tự có dấu tiếng Việt (\b hỏng với Unicode) → dùng ranh giới thủ công.
function hasEatenIntent(s) {
  if (/\b(ate|eaten|eating|had|have had|drank|drinking|snacked|just ate|log|logged|logging)\b/.test(s)) return true;
  if (/(^|[^a-zà-ỹ])(ăn|uống|nhậu|măm|mằm|đớp|nạp|ghi|vừa ăn|mới ăn|đã ăn)([^a-zà-ỹ]|$)/.test(s)) return true;
  return false;
}

// XIN GỢI Ý/ĐỀ XUẤT (không phải ghi nhận, không phải hỏi số liệu món cụ thể).
function isRecommend(s) {
  if (/\b(recommend|suggest|suggestion|suggestions|what should i (eat|have)|ideas? for|give me (some |a )?(meal|menu|dish|recipe|food))\b/.test(s)) return true;
  if (/(gợi ý|đề xuất|tư vấn|nên ăn gì|ăn gì (bây giờ|hôm nay|đây|tối nay|sáng nay|trưa nay)|cho (tôi|mình|tớ|em) (vài |mấy )?(món|thực đơn|gợi ý|đề xuất)|món nào (tốt|nên|hợp)|thực đơn (nào|gì))/.test(s)) return true;
  return false;
}

// HỎI SỐ LIỆU dinh dưỡng của một món (nutrition analysis), KHÔNG phải ghi nhận.
function isFoodAnalysis(s) {
  if (/(bao nhiêu|mấy)\s*(calo|calories|kcal|đạm|protein|carb|tinh bột|chất béo|fat|đường|natri)/.test(s)) return true;
  if (/(calo|calories|kcal|đạm|protein|carb|chất béo|fat)\b[^?]*\b(trong|của|in|of)\b/.test(s)) return true;
  if (/\b(analyze|analysis|nutrition (facts|of|in)|how many (calories|carbs|grams))\b/.test(s)) return true;
  if (/(phân tích|thành phần dinh dưỡng|dinh dưỡng (của|trong)|có bao nhiêu)/.test(s)) return true;
  return false;
}

// text → { category, action }. action ≠ null CHỈ khi category === 'COMMAND'.
export function classifyIntent(text, lang) {
  const s = String(text || '').toLowerCase().trim();
  if (!s) return { category: 'GENERAL', action: null };

  // 1) Lệnh điều khiển app — ưu tiên cao nhất (tái sử dụng detectIntent).
  const action = detectIntent(s, lang);
  if (action) return { category: 'COMMAND', action };

  // 2) Xin gợi ý → KHÔNG bao giờ hỏi bữa (kiểm tra TRƯỚC 'ăn' để không nhầm thành ghi nhận).
  if (isRecommend(s)) return { category: 'RECOMMEND', action: null };

  // 3) Ghi nhận bữa ăn (có động từ ăn/uống/log) → được phép hỏi/ghi bữa.
  if (hasEatenIntent(s)) return { category: 'LOG_MEAL', action: null };

  // 4) Hỏi số liệu dinh dưỡng một món.
  if (isFoodAnalysis(s)) return { category: 'ANALYZE_FOOD', action: null };

  // 5) Còn lại.
  return { category: 'GENERAL', action: null };
}

// Chat là bề mặt GHI NHẬN: khi backend đã nhận diện được món (<data>), hiện thẻ chọn bữa
// TRỪ KHI người dùng chỉ xin GỢI Ý hoặc đang ra LỆNH. Một câu mô tả món trần ("2 bát cơm
// ức gà") không có từ khoá → GENERAL nhưng vẫn là ứng viên ghi nhận hợp lệ ở Chat.
export function shouldShowMealCard(category) {
  return category !== 'RECOMMEND' && category !== 'COMMAND';
}

// Trợ lý giọng nói thận trọng hơn: CHỈ chủ động hỏi "ăn vào bữa nào" khi ý định là GHI NHẬN.
export function shouldAskMealTime(category) {
  return category === 'LOG_MEAL';
}
