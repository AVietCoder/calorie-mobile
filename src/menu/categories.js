/**
 * src/menu/categories.js — danh mục thư viện thực đơn.
 *
 * Bản port từ web (lib/family-menu/menu-categories.js). `id`, `label` và cặp
 * màu gradient GIỮ NGUYÊN để thẻ trên app và trên web nhận ra nhau; chỉ `icon`
 * đổi từ Font Awesome sang Ionicons vì app không nạp Font Awesome.
 *
 * Danh mục là do server gán (cột menu_templates.category) — ở đây chỉ tra ra
 * nhãn và màu, không tự suy đoán lại.
 */

export const MENU_CATEGORIES = [
  { id: 'tieu_duong', label: 'Tiểu đường', icon: 'water', from: '#5b9cf6', to: '#3b6fd4' },
  { id: 'gout', label: 'Gout', icon: 'body', from: '#a78bfa', to: '#7c5cd6' },
  { id: 'gan_nhiem_mo', label: 'Gan nhiễm mỡ', icon: 'shield-half', from: '#f5a623', to: '#d97706' },
  { id: 'huyet_ap', label: 'Huyết áp cao', icon: 'heart', from: '#f2617a', to: '#d63f5c' },
  { id: 'mo_mau', label: 'Mỡ máu cao', icon: 'pulse', from: '#f97362', to: '#dc4a37' },
  { id: 'giam_can', label: 'Giảm cân', icon: 'trending-down', from: '#4bc0a8', to: '#2a9d8f' },
  { id: 'tang_co', label: 'Tăng cơ', icon: 'barbell', from: '#6b8cff', to: '#4257c4' },
  { id: 'eat_clean', label: 'Eat clean', icon: 'leaf', from: '#7dc976', to: '#4a9d5f' },
  { id: 'gia_dinh', label: 'Gia đình Việt', icon: 'people', from: '#58a677', to: '#3d7353' },
  { id: 'van_phong', label: 'Văn phòng', icon: 'briefcase', from: '#8d99ae', to: '#5c6779' },
  { id: 'hoc_sinh', label: 'Học sinh, sinh viên', icon: 'school', from: '#ffb703', to: '#e08700' },
  { id: 'it_tinh_bot', label: 'Ít tinh bột', icon: 'nutrition', from: '#c084fc', to: '#9333ea' },
  { id: 'khac', label: 'Khác', icon: 'restaurant', from: '#9aa39e', to: '#6b7280' },
];

const BY_ID = new Map(MENU_CATEGORIES.map((c) => [c.id, c]));

/** Danh mục lạ (server thêm mới mà app chưa cập nhật) rơi về "Khác" thay vì undefined. */
export function getCategory(id) {
  return BY_ID.get(id) || BY_ID.get('khac');
}

export default { MENU_CATEGORIES, getCategory };
