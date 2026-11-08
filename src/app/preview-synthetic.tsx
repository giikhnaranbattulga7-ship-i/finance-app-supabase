import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { budgetRemaining, formatAmount, monthlyNet, sumByCurrency } from '../lib/finance';
import { profileHref } from '../lib/routes';
import { colors, touch } from '../lib/theme';

const accounts = [
  { currency: 'MNT', amount: 1_250_000.5 },
  { currency: 'USD', amount: 40 },
];
const month = monthlyNet([
  { type: 'income', amount: 800000, currency: 'MNT' },
  { type: 'expense', amount: 195000, currency: 'MNT' },
  { type: 'expense', amount: 15, currency: 'USD' },
]);
const budgets = budgetRemaining([{ limit: 150000, spent: 195000 }]);

export default function PreviewSynthetic() {
  const totals = sumByCurrency(accounts);
  return (
    <Screen title="Z Money">
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Профайл" onPress={() => router.push(profileHref)} style={styles.profile}>
          <Text style={styles.note}>Профайл</Text>
        </Pressable>
        <Text style={styles.banner}>Синтетик өгөгдөл. Санд хадгалаагүй.</Text>
        <Text style={styles.label}>Нийт үлдэгдэл</Text>
        <Text style={styles.balance}>{formatAmount(totals[0].total, 'MNT')}</Text>
        <Text style={styles.note}>Нийт үлдэгдэл зөвхөн MNT. Бусад валют доор тусдаа.</Text>
        <Text style={styles.other}>{formatAmount(totals[1].total, 'USD')}</Text>
        <Card>
          <Text style={styles.label}>Энэ сарын цэвэр</Text>
          <Text style={styles.figure}>{formatAmount(month.net, 'MNT')}</Text>
          <Text style={styles.note}>Бусад валютын гүйлгээ энэ тоонд ороогүй.</Text>
        </Card>
        <Card>
          <Text style={styles.label}>Төсвөөс үлдсэн</Text>
          <Text style={styles.figure}>{formatAmount(budgets.total ?? 0, 'MNT')} · Хэтэрсэн</Text>
        </Card>
        <View style={styles.card}>
          <Text style={styles.figure}>Хоол</Text>
          <ProgressBar value={195000 / 150000} />
          <Text style={styles.note}>Хэтэрсэн {formatAmount(budgets.lines[0].remaining, 'MNT')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  profile: { minHeight: touch, justifyContent: 'center', alignSelf: 'flex-end' },
  banner: { color: colors.text, backgroundColor: colors.card, padding: 12, borderRadius: 12, marginBottom: 16 },
  label: { color: colors.muted, fontSize: 14, marginBottom: 6 },
  balance: { color: colors.primary, fontSize: 44, fontWeight: '800' },
  figure: { color: colors.text, fontSize: 28, fontWeight: '700' },
  note: { color: colors.muted, marginTop: 6 },
  other: { color: colors.text, fontSize: 18, marginVertical: 8 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16 },
});
