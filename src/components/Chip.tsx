import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../lib/theme';

// Сонгогддог жижиг шошго (шүүлтүүр, төрөл сонгоход)
export function Chip({ label, active, onPress, color = colors.primary }: {
  label: string; active?: boolean; onPress?: () => void; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
    >
      <Text style={[styles.text, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.card, marginRight: 8, marginBottom: 8,
  },
  text: { color: colors.text, fontSize: 13, fontWeight: '500' },
});
