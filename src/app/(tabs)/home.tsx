import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Fab } from '../../components/Fab';
import { Screen } from '../../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../../components/StateViews';
import { TransactionItem } from '../../components/TransactionItem';
import { useFocusData } from '../../hooks/useAsync';
import { budgetRemaining, formatAmount, sumByCurrency } from '../../lib/finance';
import { colors, touch } from '../../lib/theme';
import { monthStartISO } from '../../lib/validation';
import { listAccounts } from '../../services/accounts';
import { listBudgets } from '../../services/budgets';
import { listTransactions, monthSummary } from '../../services/transactions';

export default function HomeScreen() {
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
    return { totals, mnt, others, summary, recent: recent.slice(0, 5), progress, hasAccounts: accounts.length > 0 };
  });

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => reload()} />;
  if (!data) return null;

  return (
    <Screen
      title="Миний мөнгө"
      right={(
        <Pressable accessibilityRole="button" accessibilityLabel="Профайл" onPress={() => router.push('/(tabs)/profile')} style={styles.profile}>
          <Ionicons name="person-outline" size={22} color={colors.text} />
        </Pressable>
      )}
    >
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        <Text style={styles.label}>Нийт үлдэгдэл</Text>
        {data.mnt ? <Text style={styles.balance}>{formatAmount(data.mnt.total, 'MNT')}</Text> : <Text style={styles.missing}>MNT данс алга</Text>}
        {data.others.length > 0 ? <Text style={styles.note}>Нийт үлдэгдэл зөвхөн MNT. Бусад валют доор тусдаа.</Text> : null}
        {data.others.map((row) => (
          <Text key={row.currency} style={styles.other}>{formatAmount(row.total, row.currency)}</Text>
        ))}

        <Card>
          <Text style={styles.label}>Энэ сарын цэвэр</Text>
          <Text style={styles.figure}>{formatAmount(data.summary.net, 'MNT')}</Text>
          <Text style={styles.note}>Орлого {formatAmount(data.summary.income, 'MNT')} · Зарлага {formatAmount(data.summary.expense, 'MNT')}</Text>
          {data.summary.excludedOtherCurrency ? <Text style={styles.note}>Бусад валютын гүйлгээ энэ тоонд ороогүй.</Text> : null}
        </Card>

        <Card>
          <Text style={styles.label}>Төсвөөс үлдсэн</Text>
          {data.progress.total == null ? <Text style={styles.missing}>Төсөв алга</Text> : (
            <Text style={styles.figure}>
              {formatAmount(data.progress.total, 'MNT')}{data.progress.total < 0 ? ' · Хэтэрсэн' : ''}
            </Text>
          )}
        </Card>

        {!data.hasAccounts ? (
          <Card>
            <Text style={styles.note}>Эхлээд профайлаас данс нэмнэ үү.</Text>
          </Card>
        ) : null}

        <Text style={styles.section}>Сүүлийн гүйлгээ</Text>
        {data.recent.length === 0 ? <EmptyView title="Гүйлгээ алга" subtitle="+ товчоор эхний гүйлгээгээ нэмээрэй" /> : null}
        {data.recent.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} onPress={() => router.push(`/transaction/${tx.id}`)} />
        ))}
      </ScrollView>
      <Fab onPress={() => router.push('/transaction/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120 },
  profile: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.muted, fontSize: 14, marginBottom: 6 },
  balance: { color: colors.primary, fontSize: 44, fontWeight: '800', marginBottom: 16 },
  figure: { color: colors.text, fontSize: 28, fontWeight: '700' },
  missing: { color: colors.text, fontSize: 22, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 13, marginTop: 6 },
  other: { color: colors.text, fontSize: 18, marginTop: 4 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10, marginTop: 8 },
});
