// src/api/llm.js
// Kết nối THẲNG tới server LLM (vLLM, giao thức OpenAI /chat/completions) — cùng cơ chế
// với lib/llm.js của backend THT-D3: cấu hình qua process.env.LLM_BASE_URL / LLM_API_KEY /
// LLM_MODEL. app.config.js đọc chúng từ .env (file `vercel env pull` sẵn có) lúc build và
// nhúng vào `extra`; EXPO_PUBLIC_LLM_* (nếu đặt) được ưu tiên vì là override tường minh.
//
// LÝ DO TỒN TẠI: backend chạy Vercel gói Hobby bị chặn mỗi request ở 60s. Câu nói không
// khớp keyword món ăn/casual bị /api/chat xếp MẶC ĐỊNH vào nhánh coach — prompt chứa cả
// thực đơn 7 ngày + sinh tối đa 2500 token (~60s ở tốc độ ~42 token/giây của server hiện
// tại) → lượt Trợ lý thường xuyên bị giết giữa chừng. Gọi thẳng vLLM thì không còn trần
// 60s, và Trợ lý dùng prompt GỌN (src/agent/agentLLM.js) nên trả lời trong vài giây.
import Constants from 'expo-constants';

const extra = Constants?.expoConfig?.extra || {};

export const LLM_BASE_URL =
  process.env.EXPO_PUBLIC_LLM_BASE_URL || extra.LLM_BASE_URL || '';
// vLLM yêu cầu một chuỗi bất kỳ kể cả khi không bật --api-key (giống lib/llm.js web).
export const LLM_API_KEY =
  process.env.EXPO_PUBLIC_LLM_API_KEY || extra.LLM_API_KEY || 'EMPTY';
export const LLM_MODEL =
  process.env.EXPO_PUBLIC_LLM_MODEL || extra.LLM_MODEL || 'qwen2.5-vl';

// Thiếu BASE_URL → mọi nơi tự rơi về đường backend cũ (không hỏng tính năng).
export function llmDirectAvailable() {
  return Boolean(LLM_BASE_URL);
}

// POST /chat/completions với timeout riêng. Mặc định 120s: gọi thẳng nên không dính trần
// 60s của Vercel, nhưng vẫn cần trần để UI không treo vô hạn khi server GPU nghẽn.
async function postCompletion(body, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${LLM_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const err = new Error(
        data?.error?.message || (typeof data?.error === 'string' ? data.error : `LLM lỗi ${res.status}`)
      );
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Hết thời gian chờ máy chủ AI.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Gọi chat completion. Server trả 400 vì response_format/extra_body (bản vLLM không hỗ
// trợ) → tự bỏ hai field đó rồi thử lại MỘT lần — cùng chiến lược safeChatCreate của web.
export async function llmChat({ messages, max_tokens = 600, temperature = 0.3, timeoutMs = 120000, ...rest }) {
  const body = { model: LLM_MODEL, messages, max_tokens, temperature, ...rest };
  try {
    return await postCompletion(body, timeoutMs);
  } catch (e) {
    if (e?.status === 400 && (body.response_format || body.extra_body)) {
      const { response_format, extra_body, ...slim } = body;
      return postCompletion(slim, timeoutMs);
    }
    throw e;
  }
}
