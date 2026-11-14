import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../lib/theme';

// Header-гүй дэлгэцүүдийн нийтлэг бүрхүүл: safe area + гарчиг + баруун талын товч.
// Өргөн дэлгэцэн дээр агуулга 480-аас өргөн болохгүй, утсан дээр бүтэн өргөн.
export function Screen({ title, right, children }: PropsWithChildren<{ title?: string; right?: React.ReactNode }>) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.frame}>
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {right}
          </View>
        ) : null}
        <View style={styles.body}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  body: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, zIndex: 2 },
  title: { flexShrink: 1, fontSize: 28, fontWeight: '700', color: colors.text },
});
