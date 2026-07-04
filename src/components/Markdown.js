// src/components/Markdown.js
// Trình render Markdown nhẹ cho câu trả lời AI (port ý tưởng renderMarkdown ở web
// public/chat.js). Hỗ trợ: tiêu đề (#..######), **đậm**, *nghiêng*, `code`,
// và danh sách gạch đầu dòng (-, *, •). Không dùng thư viện ngoài.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

// Render inline: **đậm**, *nghiêng*, `code`
function renderInline(text, keyPrefix) {
  const nodes = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Text key={`${keyPrefix}-t${i++}`}>{text.slice(last, m.index)}</Text>);
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<Text key={`${keyPrefix}-b${i++}`} style={styles.bold}>{tok.slice(2, -2)}</Text>);
    } else if (tok.startsWith('`')) {
      nodes.push(<Text key={`${keyPrefix}-c${i++}`} style={styles.code}>{tok.slice(1, -1)}</Text>);
    } else {
      nodes.push(<Text key={`${keyPrefix}-i${i++}`} style={styles.italic}>{tok.slice(1, -1)}</Text>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(<Text key={`${keyPrefix}-t${i++}`}>{text.slice(last)}</Text>);
  return nodes.length ? nodes : text;
}

export default function Markdown({ text, style, color }) {
  const base = [{ color: color || colors.textMain }, styles.baseText, style];
  const lines = String(text || '').split('\n');
  const blocks = [];

  lines.forEach((line, idx) => {
    const h = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
    const li = line.match(/^\s*[-*•]\s+(.+?)\s*$/);
    if (h) {
      const lvl = h[1].length;
      blocks.push(
        <Text key={idx} style={[base, styles.heading, { fontSize: lvl <= 2 ? 16 : 15 }]}>
          {renderInline(h[2], `h${idx}`)}
        </Text>,
      );
    } else if (li) {
      blocks.push(
        <View key={idx} style={styles.liRow}>
          <Text style={[base, styles.bullet]}>•</Text>
          <Text style={[base, styles.liText]}>{renderInline(li[1], `li${idx}`)}</Text>
        </View>,
      );
    } else if (line.trim() === '') {
      blocks.push(<View key={idx} style={styles.gap} />);
    } else {
      blocks.push(
        <Text key={idx} style={base}>{renderInline(line, `p${idx}`)}</Text>,
      );
    }
  });

  return <View>{blocks}</View>;
}

const styles = StyleSheet.create({
  baseText: { fontSize: 14, lineHeight: 21 },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  code: {
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  heading: { fontWeight: '800', marginTop: 2, marginBottom: 2 },
  liRow: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  bullet: { lineHeight: 21 },
  liText: { flex: 1 },
  gap: { height: 6 },
});
