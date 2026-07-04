// Sage & Cream palette - đồng bộ với web
// Giữ nguyên brand color. Chỉ tinh chỉnh contrast, surface, elevation.
export const colors = {
  // Brand (giữ nguyên)
  primary: '#58A677',
  primaryDark: '#3D7353',
  primarySoft: '#E8F2EC',

  // Surfaces
  bg: '#F5F7F5',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFBFA',
  surfaceElevated: '#FFFFFF',
  cream: '#FBF7EE',

  // Text (cải thiện contrast theo WCAG)
  textMain: '#1A1D1F',
  textSub: '#6B7280',
  textMuted: '#9AA1A9',

  // Borders / dividers
  border: '#E8EBE9',
  borderStrong: '#D6DAD8',
  divider: '#EEF1EF',
  muted: '#B2BEC3',

  // Semantic
  danger: '#E5484D',
  dangerSoft: '#FDECEE',
  warning: '#F5A524',
  warningSoft: '#FEF3E2',
  info: '#3B82F6',
  infoSoft: '#E7F0FE',
  success: '#22A06B',
  successSoft: '#E6F4EE',

  // Overlays
  overlay: 'rgba(15, 23, 20, 0.45)',
  scrim: 'rgba(15, 23, 20, 0.65)',
};

// 4-based spacing scale
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40,
};

// Radius tokens
export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, full: 999 };

// Typography (Material 3 inspired scale)
export const font = {
  size: { xs: 11, sm: 13, md: 14, lg: 16, xl: 18, xxl: 22, xxxl: 28, display: 34 },
  weight: { normal: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
  // Line-height ratios
  lh: { tight: 1.2, snug: 1.35, normal: 1.5, relaxed: 1.65 },
};

// Elevation levels — nhẹ, tinh tế theo phong cách iOS/M3
export const shadow = {
  // Level 0 — flat
  none: {},
  // Level 1 — subtle hairline
  xs: {
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  // Level 2 — card mặc định
  card: {
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  sm: {
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  // Level 3 — floating (FAB, sheet)
  md: {
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  // Level 4 — modal / dialog
  lg: {
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 12,
  },
};

// Motion tokens
export const motion = {
  duration: { fast: 150, base: 220, slow: 320 },
};
