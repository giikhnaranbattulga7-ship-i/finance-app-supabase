import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Fab } from '../../components/Fab';
import { Screen } from '../../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../../components/StateViews';
import { TransactionItem } from '../../components/TransactionItem';
import { useFocusData } from '../../hooks/useAsync';
import { budgetRemaining, formatAmount, sumByCurrency } from '../../lib/finance';
import { profileHref } from '../../lib/routes';
import { colors, spacing, touch } from '../../lib/theme';
import { monthStartISO } from '../../lib/validation';
import { listAccounts } from '../../services/accounts';
import { listBudgets } from '../../services/budgets';
import { listTransactions, monthSummary } from '../../services/transactions';

// Нүүр: гурван тоо тусдаа. Үлдэгдэл, энэ сарын цэвэр, төсвөөс үлдсэн нь нэг тоо биш.
export default function HomeScreen() {
  const focused = useIsFocused();
  const { data, loading, error, refreshing, refresh, reload } = useFocusData(async () => {
    const month = monthStartISO();
    const [accounts, summary, recent, budgets] = await Promise.all([
      listAccounts(),
      monthSummary(month),
      listTransactions({ sort: 'date_desc' }, 0),
      listBudgets(month),
    ]);
    const totals = sumByCurrency(accounts.map((account) => ({ currency: account.currency, amount: Number(account.balance) })));
    const mnt = totals.find((row) => row.currency === 'MNT');
    const others = totals.filter((row) => row.currency !== 'MNT');
    const progress = budgetRemaining(budgets.map((budget) => ({
      limit: Number(budget.limit_amount),
      spent: summary.byCategory[budget.category_id]?.total ?? 0,
    })));
    return { mnt, others, summary, recent: recent.slice(0, 5), progress, hasAccounts: accounts.length > 0 };
  });

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => reload()} />;
  if (!data) return null;

  return (
    <Screen
      title="Z Money"
      right={(
        <Pressable accessibilityRole="button" accessibilityLabel="Профайл" hitSlop={8} onPress={() => router.push(profileHref)} style={styles.profile}>
          <Ionicons name="person-outline" size={22} color={colors.text} />
        </Pressable>
      )}
    >
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        <Text style={styles.label}>Нийт үлдэгдэл</Text>
        {data.mnt ? <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatAmount(data.mnt.total, 'MNT')}</Text> : <Text style={styles.missing}>MNT данс алга</Text>}
        {data.others.length > 0 ? <Text style={styles.note}>Нийт үлдэгдэл зөвхөн MNT. Бусад валют доор тусдаа.</Text> : null}
        {data.others.map((row) => (
          <Text key={row.currency} style={styles.other}>{formatAmount(row.total, row.currency)}</Text>
        ))}

        <View style={styles.block}>
          <Text style={styles.label}>Энэ сарын цэвэр</Text>
          <Text style={styles.figure}>{formatAmount(data.summary.net, 'MNT')}</Text>
          {data.summary.excludedOtherCurrency ? <Text style={styles.note}>Бусад валютын гүйлгээ энэ тоонд ороогүй.</Text> : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Төсвөөс үлдсэн</Text>
          {data.progress.total == null ? <Text style={styles.missing}>Төсөв алга</Text> : (
            <Text style={styles.figure}>
              {formatAmount(data.progress.total, 'MNT')}{data.progress.total < 0 ? ' · Хэтэрсэн' : ''}
            </Text>
          )}
        </View>

        {!data.hasAccounts ? <Text style={styles.note}>Эхлээд профайлаас данс нэмнэ үү.</Text> : null}

        <Text style={styles.section}>Сүүлийн гүйлгээ</Text>
        {data.recent.length === 0 ? <EmptyView title="Гүйлгээ алга" subtitle="+ товчоор эхний гүйлгээгээ нэмээрэй" /> : null}
        {data.recent.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} onPress={() => router.push(`/transaction/${tx.id}`)} />
        ))}
      </ScrollView>
      {focused ? <Fab onPress={() => router.push('/transaction/new')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: 120 },
  profile: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.muted, fontSize: 14, marginBottom: spacing.sm },
  balance: { color: colors.primary, fontSize: 48, fontWeight: '800' },
  figure: { color: colors.text, fontSize: 32, fontWeight: '700' },
  missing: { color: colors.text, fontSize: 22, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  other: { color: colors.text, fontSize: 18, marginTop: spacing.xs },
  block: { marginTop: spacing.lg },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.lg },
});
