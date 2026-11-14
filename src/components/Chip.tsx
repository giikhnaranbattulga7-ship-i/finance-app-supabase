import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../lib/theme';

// Сонгогддог жижиг шошго (шүүлтүүр, төрөл сонгоход)
export function Chip({ label, active, onPress, color = colors.primary }: {
  label: string; active?: boolean; onPress?: () => void; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: color }, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.text, active && { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 999, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.card, marginRight: 8, marginBottom: 8,
  },
  text: { color: colors.text, fontSize: 13, fontWeight: '500' },
});
