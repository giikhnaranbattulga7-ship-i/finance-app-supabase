import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

// 0..1 хувийг харуулах зурвас. 1-ээс хэтэрвэл улаан болно (төсөв хэтэрсэн)
export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  const pct = Math.min(Math.max(value, 0), 1);
  const barColor = value > 1 ? colors.expense : value > 0.8 ? colors.warning : color;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
