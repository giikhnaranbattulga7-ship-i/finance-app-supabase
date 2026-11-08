import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';

// Header-гүй дэлгэцүүдийн нийтлэг бүрхүүл: safe area + гарчиг + баруун талын товч
export function Screen({ title, right, children }: PropsWithChildren<{ title?: string; right?: React.ReactNode }>) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {right}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, zIndex: 2 },
  title: { flexShrink: 1, fontSize: 26, fontWeight: '700', color: colors.text },
});
