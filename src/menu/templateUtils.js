/**
 * src/menu/templateUtils.js — đọc cây thực đơn mẫu (menu_template_*).
 *
 * Bản port từ web (components/menu-library/template-day-utils.js). Thuần dữ
 * liệu: không JSX, không state, không gọi mạng.
 *
 * KHÁC BIỆT DUY NHẤT so với bản web, và là khác biệt bắt buộc: web dùng lớp ký
 * tự Unicode `\p{L}` / `\p{N}` với cờ /u. Hermes (máy JS của React Native) không
 * bảo đảm có Unicode property escapes, và regex hỏng ở đây không ném lỗi lúc
 * build mà chỉ âm thầm cắt sai tên món lúc chạy. Nên viết thẳng dải ký tự
 * Latin + Việt: kết quả y hệt trên bộ dữ liệu này nhưng chạy được ở mọi máy JS.
 */
import { MEAL_ORDER } from './labels';

/** Icon Ionicons cho từng bữa — dùng chung giữa thẻ ngày và modal chi tiết. */
export const MEAL_ICON = {
  breakfast: 'cafe',
  lunch: 'restaurant',
  dinner: 'moon',
  snack: 'nutrition',
};

/** Các bữa của một ngày, đã sắp theo nhịp ăn trong ngày. */
export function mealsOf(day) {
  return [...(day?.menu_template_meals || [])].sort(
    (a, b) => (MEAL_ORDER[a.meal_type] || 99) - (MEAL_ORDER[b.meal_type] || 99)
  );
}

export const kcalOf = (dishes) => (dishes || []).reduce((s, d) => s + (Number(d.calories) || 0), 0);

/**
 * Đơn vị định lượng xuất hiện trong bộ thực đơn chuẩn.
 * Xếp DÀI TRƯỚC NGẮN: nếu 'l' đứng trước 'ly' thì "1 ly" bị khớp thành "1 l".
 */
const UNITS = [
  'gram', 'gam', 'lít', 'lit', 'kg', 'ml', 'g', 'l',
  'chén', 'bát', 'tô', 'ly', 'cốc', 'hũ', 'hộp', 'chai', 'lon', 'gói', 'vỉ', 'bìa',
  'quả', 'trái', 'củ', 'bó', 'con', 'miếng', 'lát', 'múi', 'nhánh', 'bắp', 'ổ',
  'thìa', 'muỗng', 'suất', 'phần', 'chiếc',
];

/*
 * CỐ Ý KHÔNG đưa vào UNITS: "trứng", "ngô", "sữa", "hạt", "ức", "bánh", "tép".
 * Chúng là TÊN THỰC PHẨM chứ không phải đơn vị đếm, coi là đơn vị thì cắt mất
 * cả tên món:
 *     "1 trứng ốp la"        → "Ốp la"
 *     "1 ngô luộc"           → "Luộc"
 *     "1 sữa chua ít đường"  → "Chua ít đường"
 * Những trường hợp đó do LEAD_COUNT_RE bên dưới xử lý: chỉ bỏ con số, giữ
 * nguyên danh từ.
 */

/** Chữ cái Latin + toàn bộ vùng dấu tiếng Việt. Thay cho \p{L}. */
const LETTER = 'A-Za-z\\u00C0-\\u024F\\u1E00-\\u1EFF';
/** Chữ cái + chữ số. Thay cho [\p{L}\p{N}]. */
const LETTER_NUM = `0-9${LETTER}`;

/*
 * Bắt cụm "SỐ + ĐƠN VỊ" ở bất kỳ đâu trong tên món:
 *   "200 g cháo yến mạch"            → 200 g
 *   "1 quả táo và 10 g bơ đậu phộng" → 1 quả · 10 g
 *   "½ quả táo" · "1,5 chén" · "1–1,5 bát"
 *
 * Không dùng \b sau đơn vị: \b của JS chỉ tính [A-Za-z0-9_], nên đơn vị kết
 * thúc bằng chữ có dấu ("củ", "bó") sẽ không có ranh giới từ.
 */
const AMOUNT_SRC =
  '(\\d+(?:[.,]\\d+)?(?:\\s*[–—-]\\s*\\d+(?:[.,]\\d+)?)?|[½¼¾⅓⅔⅛])'
  + '\\s*(' + UNITS.join('|') + ')'
  + `(?![${LETTER_NUM}])`;

const AMOUNT_RE = new RegExp(AMOUNT_SRC, 'gi');

/*
 * Số đếm đứng ĐẦU tên món mà không kèm đơn vị: "1 trứng ốp la", "5–6 hạt óc
 * chó". Vẫn là định lượng, chỉ là tiếng Việt lược mất đơn vị.
 *
 * CHỈ bắt ở đầu chuỗi. Số nằm giữa tên món mà không có đơn vị thì gần như luôn
 * là một phần của tên ("Cá kho tộ 2 lửa"), cắt đi là hỏng nghĩa.
 */
const LEAD_COUNT_RE = new RegExp(
  `^\\s*(\\d+(?:[.,]\\d+)?(?:\\s*[–—-]\\s*\\d+(?:[.,]\\d+)?)?|[½¼¾⅓⅔⅛⅕])\\s+(?=[${LETTER}])`
);

/**
 * Tách tên món thành các đoạn để tô đậm phần định lượng.
 * Trả mảng (không trả phần tử React) để nơi gọi tự quyết định bọc bằng gì.
 *
 * @param {string} text
 * @returns {{ text: string, amount: boolean }[]}
 */
export function splitAmounts(text) {
  const s = String(text || '');
  if (!s) return [];

  const out = [];
  let last = 0;
  // Regex có cờ /g → phải reset lastIndex, nếu không lần gọi sau bắt đầu lệch.
  AMOUNT_RE.lastIndex = 0;

  /* Số đếm trần ở đầu chuỗi — chỉ khi CHÍNH vị trí 0 không phải cụm số+đơn vị,
     nếu không "1 chén cơm" bị tính hai lần. */
  const first = AMOUNT_RE.exec(s);
  AMOUNT_RE.lastIndex = 0;
  if (!(first && first.index === 0)) {
    const lead = s.match(LEAD_COUNT_RE);
    if (lead) {
      out.push({ text: lead[0], amount: true });
      last = lead[0].length;
      AMOUNT_RE.lastIndex = last;
    }
  }

  let m;
  while ((m = AMOUNT_RE.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), amount: false });
    out.push({ text: m[0], amount: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), amount: false });
  return out.length ? out : [{ text: s, amount: false }];
}

/**
 * Tên món ĐÃ BỎ định lượng — dùng cho thẻ tóm tắt 7 ngày.
 *
 *   "200 g cháo yến mạch nấu tôm"    → "Cháo yến mạch nấu tôm"
 *   "1 quả táo và 10 g bơ đậu phộng" → "Táo và bơ đậu phộng"
 *
 * Thẻ ngày chỉ để liếc xem hôm đó ăn gì; con số làm dòng dài ra và đẩy tên món
 * xuống dòng. Định lượng đầy đủ nằm trong modal chi tiết.
 *
 * Bỏ hết mà rỗng (tên món vốn chỉ là "100 g") thì giữ nguyên bản gốc — thà hiện
 * con số còn hơn hiện ô trống.
 */
export function stripAmounts(text) {
  const s = String(text || '').trim();
  if (!s) return '';

  AMOUNT_RE.lastIndex = 0;
  const out = s
    .replace(AMOUNT_RE, ' ')
    // Bỏ số đếm trần còn sót ở đầu. Chạy SAU AMOUNT_RE vì "1 chén cơm" phải
    // được cụm số+đơn vị xử lý trước.
    .replace(LEAD_COUNT_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!out) return s;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Tổng dinh dưỡng của một ngày trong THƯ VIỆN.
 * KHÔNG nhân theo số suất — thư viện là bản mẫu gốc, phần nhân nằm ở kế hoạch.
 */
export function templateDayTotals(day) {
  const dishes = mealsOf(day).flatMap((m) => m.menu_template_dishes || []);
  const total = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };
  for (const d of dishes) {
    for (const k of Object.keys(total)) total[k] += Number(d[k]) || 0;
  }
  return { ...total, dishes };
}

/** Trung bình kcal mỗi ngày — chỉ tính ngày thực sự có số. */
export function avgKcal(days) {
  const perDay = (days || [])
    .map((d) => kcalOf(mealsOf(d).flatMap((m) => m.menu_template_dishes || [])))
    .filter((v) => v > 0);
  if (!perDay.length) return null;
  return Math.round(perDay.reduce((s, v) => s + v, 0) / perDay.length);
}

/** Đếm tổng số món của cả thực đơn. */
export function countDishes(days) {
  return (days || []).reduce(
    (s, d) => s + mealsOf(d).reduce((n, m) => n + (m.menu_template_dishes?.length || 0), 0),
    0
  );
}

export default {
  MEAL_ICON, mealsOf, kcalOf, splitAmounts, stripAmounts,
  templateDayTotals, avgKcal, countDishes,
};
