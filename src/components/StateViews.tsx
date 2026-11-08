import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { Button } from './Button';

// Ачаалж буй / хоосон / алдааны төлөвүүд — бүх дэлгэцэд нэгдмэл харагдана
export function LoadingView({ text = 'Ачаалж байна...' }: { text?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

export function EmptyView({ title, subtitle, icon = 'file-tray-outline' }: {
  title: string; subtitle?: string; icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={48} color={colors.muted} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.text} />
      <Text style={styles.title}>Алдаа гарлаа</Text>
      <Text style={styles.muted}>{message}</Text>
      {onRetry ? <Button title="Дахин оролдох" variant="outline" onPress={onRetry} style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 240 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 12, textAlign: 'center' },
  muted: { color: colors.muted, marginTop: 6, textAlign: 'center' },
});
