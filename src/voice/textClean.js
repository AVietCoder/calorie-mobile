// src/voice/textClean.js
// Tiện ích làm sạch nội dung AI dùng CHUNG cho Chat (hiển thị) và Trợ lý giọng nói (đọc).
// Trích từ ChatScreen để không lặp code — hành vi hiển thị của Chat giữ nguyên.

// Bỏ các thẻ điều khiển của backend (<data>, <message>, ...) khỏi nội dung hiển thị.
export function cleanDisplayContent(content) {
  if (!content) return '';
  return String(content)
    .replace(/<message>[\s\S]*?<\/message>/gi, '')
    .replace(/<data>[\s\S]*?<\/data>/gi, '')
    .replace(/<image>[\s\S]*?<\/image>/gi, '')
    .replace(/<error>[\s\S]*?<\/error>/gi, '')
    .replace(/<deleted>[\s\S]*?<deleted>/gi, '')
    .replace(/\n{3,}/g, '\n\n') // Thu gọn khoảng trống thừa
    .trim();
}

// Trích JSON dinh dưỡng trong thẻ <data>...</data> (nếu có) — dùng để hiện thẻ dinh dưỡng
// và để Trợ lý biết vừa phân tích được một món ăn cần hỏi "ăn vào bữa nào".
export function extractData(text = '') {
  const match = String(text).match(/<data>([\s\S]*?)<\/data>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// Chuẩn hoá văn bản để ĐỌC bằng TTS: bỏ markdown/emoji-symbol để giọng đọc tự nhiên,
// không đọc "dấu sao sao" hay đường link. Chỉ dùng cho luồng giọng nói.
export function stripForSpeech(input) {
  if (!input) return '';
  let s = cleanDisplayContent(input);
  s = s
    .replace(/```[\s\S]*?```/g, ' ')            // code block
    .replace(/`([^`]*)`/g, '$1')                // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')      // ảnh markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // link -> chỉ giữ chữ
    .replace(/^#{1,6}\s*/gm, '')                // tiêu đề #
    .replace(/(\*\*|__)(.*?)\1/g, '$2')         // đậm
    .replace(/[*_>#`~|]/g, ' ')                 // ký hiệu markdown còn lại
    .replace(/^\s*[-•]\s*/gm, '')               // gạch đầu dòng
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s;
}
