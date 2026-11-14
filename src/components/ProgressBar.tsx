import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

// 0..1 зурвас. Хэтрэлтийг өнгөөр биш, хажуугийн «Хэтэрсэн» үгээр харуулна.
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 1);
  const barColor = colors.primary;
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
