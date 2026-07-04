// src/components/Charts.js
// Bộ biểu đồ SVG tự vẽ (react-native-svg sẵn có) để khớp các chart Chart.js của web
// diet-details.js mà react-native-chart-kit không hỗ trợ:
//   - DonutChart:     doughnut có cutout + chữ ở tâm (macro 72%, BMR/TDEE 68%)
//   - BarGoalChart:   bar chart 7 ngày + đường mục tiêu NÉT ĐỨT màu vàng
//   - PolarAreaChart: polarArea BMR/TDEE/Mục tiêu với nhãn giá trị luôn hiển thị
// Màu sắc giữ đúng PALETTE của web: #c25b4a / #b8975a / #7d9b76 / #4d6549.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Line, Path, Polyline, Text as SvgText, G } from 'react-native-svg';

/* ── DonutChart ──────────────────────────────────────────────────────────── */
export function DonutChart({
  size = 180,
  cutout = 0.72,           // tỉ lệ lỗ giữa (web: 72% macro, 68% BMR)
  data = [],               // [{ value, color, label }]
  centerTop = '',          // dòng to ở tâm (vd tổng kcal)
  centerBottom = '',       // dòng nhỏ ở tâm (vd 'kcal')
  legend = true,
}) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
  const rOuter = size / 2;
  const thickness = rOuter * (1 - cutout);
  const r = rOuter - thickness / 2;
  const C = 2 * Math.PI * r;
  const GAP = 3; // khe trắng giữa các phần (web dùng borderColor #fff, borderWidth 3)

  let acc = 0;
  const segs = data
    .filter((d) => (Number(d.value) || 0) > 0)
    .map((d, i) => {
      const frac = (Number(d.value) || 0) / total;
      const len = Math.max(0, frac * C - GAP);
      const seg = (
        <Circle
          key={i}
          cx={rOuter} cy={rOuter} r={r}
          stroke={d.color} strokeWidth={thickness} fill="none"
          strokeDasharray={`${len} ${C - len}`}
          strokeDashoffset={-acc * C}
          rotation={-90} originX={rOuter} originY={rOuter}
        />
      );
      acc += frac;
      return seg;
    });

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>{segs}</Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {!!centerTop && <Text style={chartStyles.centerTop}>{centerTop}</Text>}
            {!!centerBottom && <Text style={chartStyles.centerBottom}>{centerBottom}</Text>}
          </View>
        </View>
      </View>
      {legend && (
        <View style={chartStyles.legendRow}>
          {data.map((d, i) => (
            <View key={i} style={chartStyles.legendItem}>
              <View style={[chartStyles.legendDot, { backgroundColor: d.color }]} />
              <Text style={chartStyles.legendText}>{d.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ── BarGoalChart ────────────────────────────────────────────────────────── */
export function BarGoalChart({
  width = 320,
  height = 210,
  labels = [],
  data = [],
  goal = 0,                // đường mục tiêu (0 = ẩn)
  barColor = '#7d9b76',
  goalColor = '#b8975a',
  unit = 'kcal',
  goalLabel = '',
}) {
  const PAD_L = 8, PAD_R = 8, PAD_T = 14, LABEL_H = 22;
  const plotH = height - PAD_T - LABEL_H;
  const maxVal = Math.max(...data.map((v) => Number(v) || 0), Number(goal) || 0, 1) * 1.08;
  const n = Math.max(data.length, 1);
  const slot = (width - PAD_L - PAD_R) / n;
  const barW = Math.min(36, slot * 0.62); // web maxBarThickness: 36

  const yFor = (v) => PAD_T + plotH * (1 - (Number(v) || 0) / maxVal);

  return (
    <View>
      <Svg width={width} height={height}>
        {/* lưới ngang nhẹ (web grid rgba(125,155,118,0.08)) */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <Line key={i} x1={PAD_L} x2={width - PAD_R}
            y1={PAD_T + plotH * f} y2={PAD_T + plotH * f}
            stroke="rgba(125,155,118,0.12)" strokeWidth={1} />
        ))}
        {data.map((v, i) => {
          const x = PAD_L + slot * i + (slot - barW) / 2;
          const y = yFor(v);
          return (
            <G key={i}>
              <Rect x={x} y={y} width={barW} height={PAD_T + plotH - y}
                rx={8} fill={barColor} opacity={0.85} />
              <SvgText x={PAD_L + slot * i + slot / 2} y={height - 6}
                fontSize={11} fill="#636e72" textAnchor="middle" fontWeight="600">
                {labels[i] ?? ''}
              </SvgText>
            </G>
          );
        })}
        {/* Đường mục tiêu nét đứt màu vàng — giống web (borderDash [5,5]) */}
        {goal > 0 && (
          <Line x1={PAD_L} x2={width - PAD_R} y1={yFor(goal)} y2={yFor(goal)}
            stroke={goalColor} strokeWidth={2} strokeDasharray="5 5" />
        )}
      </Svg>
      {goal > 0 && !!goalLabel && (
        <View style={chartStyles.legendRow}>
          <View style={chartStyles.legendItem}>
            <View style={[chartStyles.legendDash, { backgroundColor: goalColor }]} />
            <Text style={chartStyles.legendText}>{goalLabel}: {Number(goal).toLocaleString()} {unit}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ── PolarAreaChart ──────────────────────────────────────────────────────── */
const polarPoint = (cx, cy, r, angleDeg) => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};
const sectorPath = (cx, cy, r, a0, a1) => {
  const p0 = polarPoint(cx, cy, r, a0);
  const p1 = polarPoint(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
};

export function PolarAreaChart({
  size = 240,
  data = [],               // [{ value, color, border, label }]
  unit = 'kcal',
}) {
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 14;
  const maxVal = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  const step = 360 / Math.max(data.length, 1);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* vòng lưới (web grid rgba(125,155,118,0.15)) */}
        {[0.33, 0.66, 1].map((f, i) => (
          <Circle key={i} cx={cx} cy={cy} r={R * f} fill="none"
            stroke="rgba(125,155,118,0.15)" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const r = (Math.max(Number(d.value) || 0, 0) / maxVal) * R;
          return (
            <Path key={i} d={sectorPath(cx, cy, r, step * i, step * (i + 1))}
              fill={d.color} stroke={d.border} strokeWidth={2} />
          );
        })}
        {/* nhãn luôn hiển thị (web plugin alwaysTooltip) */}
        {data.map((d, i) => {
          const midA = step * i + step / 2;
          const r = Math.max(((Number(d.value) || 0) / maxVal) * R * 0.62, R * 0.3);
          const p = polarPoint(cx, cy, r, midA);
          return (
            <G key={`t${i}`}>
              <SvgText x={p.x} y={p.y - 3} fontSize={11} fontWeight="700"
                fill="#2D3A2D" textAnchor="middle">{d.label}</SvgText>
              <SvgText x={p.x} y={p.y + 10} fontSize={10} fontWeight="600"
                fill="#6a7a66" textAnchor="middle">
                {Number(d.value).toLocaleString()} {unit}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/* ── WeekLinesChart ──────────────────────────────────────────────────────── */
/** Nhiều đường theo ngày + đường mục tiêu NÉT ĐỨT cùng màu (nhạt hơn) — dùng cho
 *  "Chất dinh dưỡng 7 ngày vs khuyến nghị" (khớp chart Chart.js trên web).
 *  series: [{ name, color, data: number[], target?: number }] */
export function WeekLinesChart({ width = 320, height = 200, labels = [], series = [], unit = 'g' }) {
  const PAD_L = 8, PAD_R = 8, PAD_T = 12, LABEL_H = 22;
  const plotH = height - PAD_T - LABEL_H;
  const n = Math.max(labels.length, 2);
  const maxVal = Math.max(
    1,
    ...series.flatMap((s) => [...(s.data || []), Number(s.target) || 0]),
  ) * 1.1;
  const xFor = (i) => PAD_L + ((width - PAD_L - PAD_R) / (n - 1)) * i;
  const yFor = (v) => PAD_T + plotH * (1 - (Number(v) || 0) / maxVal);

  return (
    <View>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75].map((f, i) => (
          <Line key={i} x1={PAD_L} x2={width - PAD_R}
            y1={PAD_T + plotH * f} y2={PAD_T + plotH * f}
            stroke="rgba(125,155,118,0.12)" strokeWidth={1} />
        ))}
        {series.map((s, si) => (
          <G key={si}>
            {/* đường mục tiêu nét đứt (cùng màu, nhạt) */}
            {Number(s.target) > 0 && (
              <Line x1={PAD_L} x2={width - PAD_R}
                y1={yFor(s.target)} y2={yFor(s.target)}
                stroke={s.color} strokeOpacity={0.45} strokeWidth={2} strokeDasharray="6 6" />
            )}
            <Polyline
              points={(s.data || []).map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth={2.5}
              strokeLinejoin="round" strokeLinecap="round"
            />
            {(s.data || []).map((v, i) => (
              <Circle key={i} cx={xFor(i)} cy={yFor(v)} r={3.2} fill={s.color} stroke="#fff" strokeWidth={1.2} />
            ))}
          </G>
        ))}
        {labels.map((lb, i) => (
          <SvgText key={i} x={xFor(i)} y={height - 6}
            fontSize={10.5} fill="#636e72" textAnchor="middle" fontWeight="600">
            {lb}
          </SvgText>
        ))}
      </Svg>
      <View style={chartStyles.legendRow}>
        {series.map((s, i) => (
          <View key={i} style={chartStyles.legendItem}>
            <View style={[chartStyles.legendDot, { backgroundColor: s.color }]} />
            <Text style={chartStyles.legendText}>
              {s.name}{Number(s.target) > 0 ? ` (${Math.round(s.target)}${unit})` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  centerTop: { fontSize: 20, fontWeight: '800', color: '#2D3436' },
  centerBottom: { fontSize: 11, color: '#636E72', marginTop: 1 },
  legendRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 14, marginTop: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendDash: { width: 14, height: 3, borderRadius: 2 },
  legendText: { fontSize: 12, color: '#636E72', fontWeight: '600' },
});
