/**
 * src/menu/labels.js — nhãn hiển thị của thực đơn.
 *
 * Bản port từ web (lib/excel/labels.js). Giữ NGUYÊN quy ước để hai client đọc
 * cùng một dữ liệu ra cùng một chữ: DB lưu day_index 1..7 và meal_type
 * breakfast|lunch|dinner|snack, việc dịch sang "Thứ 2" / "Bữa sáng" chỉ xảy ra
 * ở tầng hiển thị.
 */

/** day_index 1..7 → thứ trong tuần. 1 = Thứ 2 (tuần Việt Nam bắt đầu thứ Hai). */
export const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export const MEAL_LABELS = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
  snack: 'Bữa phụ',
};

/** Thứ tự hiển thị theo đúng nhịp ăn trong ngày, không theo bảng chữ cái. */
export const MEAL_ORDER = { breakfast: 1, snack: 2, lunch: 3, dinner: 4 };

export function dayLabel(dayIndex) {
  const i = Number(dayIndex);
  return DAY_LABELS[(i - 1 + 7) % 7] || `Ngày ${i}`;
}

export function mealLabel(mealType) {
  return MEAL_LABELS[mealType] || mealType || '';
}

/** day_index của HÔM NAY theo tuần Việt Nam (T2 = 1 … CN = 7). */
export function todayDayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export default { DAY_LABELS, MEAL_LABELS, MEAL_ORDER, dayLabel, mealLabel, todayDayIndex };
