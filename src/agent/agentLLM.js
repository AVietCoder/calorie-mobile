// src/agent/agentLLM.js
// Lượt hội thoại của Trợ lý (AI Agent) gọi THẲNG LLM — không đi qua backend Vercel.
//
// Vì sao: /api/chat trên Vercel Hobby bị giết ở 60s, trong khi câu KHÔNG khớp keyword
// món ăn/casual bị detectIntent (backend) xếp mặc định vào nhánh coach — prompt chứa cả
// thực đơn 7 ngày + sinh tối đa 2500 token → vượt trần → Trợ lý báo lỗi/chờ vô vọng.
// Một lượt THOẠI thực ra chỉ cần 1-3 câu trả lời + (khi có món cụ thể) mealData để hỏi
// ghi bữa. Prompt gọn dưới đây đo thực tế ~3 giây/lượt trên server vLLM hiện tại.
//
// Đánh đổi có chủ đích của đường đi thẳng (chỉ áp cho lượt THOẠI của Trợ lý):
//   - KHÔNG lưu vào chat_history server (lịch sử Chat không thấy lượt thoại này);
//   - KHÔNG tra RAG bệnh lý / foods DB / engine dinh dưỡng deterministic.
// GHI BỮA vẫn đi qua backend (ChatAPI.sendMealUpdate) nên thực đơn + nhật ký cập nhật
// đúng như cũ. Lỗi bất kỳ ở đường thẳng → AssistantContext tự rơi về /chat như trước.
import { llmChat, llmDirectAvailable } from '../api/llm';
import { DietAPI } from '../api/client';

export { llmDirectAvailable as directAgentAvailable };

// ── Ngữ cảnh nhẹ ──────────────────────────────────────────────────────────────

// Hồ sơ rút gọn cho prompt (mục tiêu/bệnh lý/calo đích) — lấy 1 lần, cache 10 phút.
// Lỗi mạng → trả cache cũ hoặc null; prompt vẫn chạy được khi thiếu hồ sơ.
let _profile = null;
let _profileAt = 0;
async function getProfileLight() {
  if (_profile && Date.now() - _profileAt < 10 * 60 * 1000) return _profile;
  try {
    const res = await DietAPI.info();
    const d = res?.data || {};
    const p = d.profile || {};
    _profile = {
      goal: p.goal || null,
      disease: p.disease || null,
      target_calories: Number(d.calories) || p.target_calories || null,
    };
    _profileAt = Date.now();
  } catch {}
  return _profile;
}

// Lịch sử NGẮN trong phiên (chỉ RAM) để câu sau hiểu câu trước. Đường backend có lịch
// sử server-side; đường đi thẳng giữ 6 lượt gần nhất là đủ cho hội thoại giọng nói.
const _history = [];
function pushHistory(role, content) {
  _history.push({ role, content: String(content || '').slice(0, 500) });
  while (_history.length > 6) _history.shift();
}

// ── Parse chịu lỗi (rút gọn từ parseModelJson của web/api/chat.js) ─────────────

const stripThink = (s = '') => String(s).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

// Xoá ký tự CJK lọt ra từ model Qwen — TTS tiếng Việt không được đọc chữ Hán/Nhật.
const stripCJK = (s = '') =>
  String(s)
    .replace(/[㐀-䶿一-鿿豈-﫿぀-ヿ＀-ﾟ]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

// Chuỗi "rác" (model lặp vô hạn "!!!!"/"4444" hoặc <40% chữ-số) → coi như không có reply.
const looksJunk = (s = '') => {
  const t = String(s).trim();
  if (t.length < 2) return true;
  if (/([^\s\\])\1{4,}/.test(t)) return true;
  const letters = (t.match(/[\p{L}\p{N}]/gu) || []).length;
  return letters < Math.max(2, t.length * 0.4);
};

const tryJson = (s) => {
  try { return JSON.parse(String(s).replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
};

// content của model → { reply, mealData } (mọi nhánh đều cố cứu ra reply dùng được).
export function parseAgentJson(raw) {
  const cleaned = stripThink(raw);
  if (!cleaned) return { reply: '', mealData: null };

  let obj = tryJson(cleaned);
  if (!obj || typeof obj !== 'object') {
    const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) obj = tryJson(fenced[1]);
  }
  if (!obj || typeof obj !== 'object') {
    const braced = cleaned.match(/\{[\s\S]*\}/);
    if (braced) obj = tryJson(braced[0]);
  }

  if (obj && typeof obj === 'object') {
    const reply = looksJunk(obj.reply) ? '' : String(obj.reply || '').trim();
    const mealData = obj.mealData && typeof obj.mealData === 'object' ? obj.mealData : null;
    return { reply, mealData };
  }

  // Không phải JSON → cứu field "reply" nếu có, không thì dùng chính đoạn prose.
  const rm = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
  if (rm) {
    let val;
    try { val = JSON.parse(`"${rm[1]}"`); } catch { val = rm[1]; }
    if (!looksJunk(val)) return { reply: val.trim(), mealData: null };
  }
  const prose = cleaned.replace(/^[`{\s]+|[`}\s]+$/g, '').trim();
  return { reply: looksJunk(prose) ? '' : prose, mealData: null };
}

// mealData hợp lệ tối thiểu để hiện thẻ/ghi bữa; điền default giống buildDataTag của web.
export function normalizeMealData(m) {
  if (!m || typeof m !== 'object') return null;
  const description = stripCJK(String(m.description || m.food || '')).trim();
  const calories = Number(m.calories);
  if (!description || !Number.isFinite(calories) || calories <= 0) return null;
  return {
    calories: Math.round(calories),
    protein: m.protein != null ? String(m.protein) : '0g',
    fat: m.fat != null ? String(m.fat) : '0g',
    carbs: m.carbs != null ? String(m.carbs) : '0g',
    fiber: m.fiber != null ? String(m.fiber) : '0g',
    sugar: m.sugar != null ? String(m.sugar) : '0g',
    sodium: m.sodium != null ? String(m.sodium) : '0mg',
    description,
    ...(m.amount ? { amount: String(m.amount) } : {}),
  };
}

// ── Prompt gọn cho lượt thoại ──────────────────────────────────────────────────

export function buildAgentPrompt({ lang, profile, lastMeal, category }) {
  const isEn = lang === 'en';
  const profileLine = profile
    ? (isEn
        ? `USER: goal ${profile.goal || 'N/A'} | target ${profile.target_calories || 'N/A'} kcal/day | condition ${profile.disease || 'none'}.`
        : `NGƯỜI DÙNG: mục tiêu ${profile.goal || 'N/A'} | calo đích ${profile.target_calories || 'N/A'} kcal/ngày | bệnh lý ${profile.disease || 'không có'}.`)
    : '';
  const lastMealLine = lastMeal?.description
    ? (isEn
        ? `MOST RECENT DISH: "${lastMeal.description}" (${lastMeal.calories ?? '?'} kcal). If the user says "last/previous/just now", they mean this dish.`
        : `MÓN GẦN NHẤT: "${lastMeal.description}" (${lastMeal.calories ?? '?'} kcal). Người dùng nói "món vừa rồi/gần nhất" tức là món này.`)
    : '';
  // Trợ lý tự quản việc hỏi bữa (chỉ hỏi khi ý định là GHI NHẬN) → cấm model tự chèn.
  const noMealQuestion = category === 'LOG_MEAL'
    ? ''
    : (isEn
        ? ' NEVER ask which meal the user ate it at.'
        : ' TUYỆT ĐỐI KHÔNG hỏi người dùng ăn vào bữa nào.');

  if (isEn) {
    return `You are the VOICE nutrition assistant of the Dr.Fit app. Reply in 1-3 short, friendly English sentences, NO markdown (the reply is read aloud).${noMealQuestion}
${profileLine}
${lastMealLine}
If the user mentions ONE SPECIFIC dish/drink, fill mealData with TOTALS for the exact amount they stated (not stated → "1 serving"); otherwise mealData is null.
RETURN PURE JSON ONLY:
{"reply":"...","mealData":{"calories":number,"protein":"Xg","fat":"Xg","carbs":"Xg","fiber":"Xg","sugar":"Xg","sodium":"Xmg","description":"dish name WITHOUT quantity","amount":"amount the user stated"} or null}
/no_think`;
  }
  return `Bạn là trợ lý dinh dưỡng bằng GIỌNG NÓI của app Dr.Fit. Trả lời 1-3 câu tiếng Việt ngắn gọn, thân thiện, KHÔNG markdown (câu trả lời sẽ được đọc to).${noMealQuestion}
${profileLine}
${lastMealLine}
Nếu người dùng nhắc MỘT MÓN ĂN/ĐỒ UỐNG CỤ THỂ, điền mealData là TỔNG theo đúng định lượng họ nói (không nói → "1 phần"); không có món cụ thể thì mealData là null.
CHỈ TRẢ JSON THUẦN:
{"reply":"...","mealData":{"calories":số,"protein":"Xg","fat":"Xg","carbs":"Xg","fiber":"Xg","sugar":"Xg","sodium":"Xmg","description":"tên món KHÔNG kèm số lượng","amount":"định lượng người dùng nói"} hoặc null}
/no_think`;
}

// ── Lượt thoại đi thẳng ────────────────────────────────────────────────────────

// Trả về CÙNG SHAPE với response của /api/chat ({ success, reply có thể kèm <data> })
// để handleUtterance trong AssistantContext dùng lại nguyên xi extractData/logMeal.
export async function directAgentTurn({ message, lastMeal, lang, category }) {
  const profile = await getProfileLight();
  const completion = await llmChat({
    messages: [
      { role: 'system', content: buildAgentPrompt({ lang, profile, lastMeal, category }) },
      ..._history,
      { role: 'user', content: message },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 600,
    temperature: 0.3,
    // Tắt thinking + phạt lặp (chống degenerate "!!!!") — server không hỗ trợ extra_body
    // thì llmChat tự bỏ và thử lại.
    extra_body: { chat_template_kwargs: { enable_thinking: false }, repetition_penalty: 1.15 },
  });

  const rawContent = completion?.choices?.[0]?.message?.content || '';
  const { reply, mealData } = parseAgentJson(rawContent);
  const cleanReply = stripCJK(reply);
  if (!cleanReply) throw new Error('LLM trả lời rỗng'); // → AssistantContext fallback /chat

  pushHistory('user', message);
  pushHistory('assistant', cleanReply);

  const meal = normalizeMealData(mealData);
  return {
    success: true,
    reply: meal ? `${cleanReply}\n<data>${JSON.stringify(meal)}</data>` : cleanReply,
    action: 'analyze_only',
    newPlan: [],
    direct: true,
  };
}
