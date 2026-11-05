import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Fab } from '../../components/Fab';
import { Screen } from '../../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../../components/StateViews';
import { TransactionItem } from '../../components/TransactionItem';
import { useAuth } from '../../context/AuthContext';
import { useFocusData } from '../../hooks/useAsync';
import { formatMoney } from '../../lib/format';
import { colors } from '../../lib/theme';
import { monthStartISO } from '../../lib/validation';
import { listAccounts } from '../../services/accounts';
import { listTransactions, monthSummary } from '../../services/transactions';

// Нүүр: нийт үлдэгдэл, энэ сарын орлого/зарлага, ангиллын график, сүүлийн гүйлгээ
export default function HomeScreen() {
  const { profile } = useAuth();
  const { data, loading, error, refreshing, refresh, reload } = useFocusData(async () => {
    const [accounts, summary, recent] = await Promise.all([
      listAccounts(),
      monthSummary(monthStartISO()),
      listTransactions({ sort: 'date_desc' }, 0),
    ]);
    return { accounts, summary, recent: recent.slice(0, 5) };
  });

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => reload()} />;
  if (!data) return null;

  const total = data.accounts.reduce((s, a) => s + Number(a.balance), 0);
  const cats = Object.values(data.summary.byCategory).sort((a, b) => b.total - a.total).slice(0, 5);
  const max = cats[0]?.total ?? 1;

  return (
    <Screen title={`Сайн уу, ${profile?.full_name || 'хэрэглэгч'} 👋`}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Нийт үлдэгдэл</Text>
          <Text style={styles.heroValue}>{formatMoney(total)}</Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>Энэ сарын орлого</Text>
              <Text style={styles.heroSmall}>+{formatMoney(data.summary.income)}</Text>
            </View>
            <View>
              <Text style={styles.heroLabel}>Энэ сарын зарлага</Text>
              <Text style={styles.heroSmall}>-{formatMoney(data.summary.expense)}</Text>
            </View>
          </View>
        </View>

        {data.accounts.length === 0 ? (
          <Card>
            <Text style={styles.section}>Эхлэх</Text>
            <Text style={{ color: colors.muted }}>Эхлээд «Данс» табаас данс (бэлэн мөнгө, карт) нэмнэ үү.</Text>
          </Card>
        ) : null}

        <Card>
          <Text style={styles.section}>Зарлага ангиллаар (энэ сар)</Text>
          {cats.length === 0 ? <Text style={{ color: colors.muted }}>Зарлага алга</Text> : null}
          {cats.map((c) => (
            <View key={c.name} style={{ marginBottom: 10 }}>
              <View style={styles.barLabel}>
                <Text style={{ color: colors.text }}>{c.name}</Text>
                <Text style={{ color: colors.muted }}>{formatMoney(c.total)}</Text>
              </View>
              <View style={styles.track}>
                <View style={{ width: `${(c.total / max) * 100}%`, height: '100%', backgroundColor: c.color, borderRadius: 999 }} />
              </View>
            </View>
          ))}
        </Card>

        <Text style={[styles.section, { marginTop: 8 }]}>Сүүлийн гүйлгээ</Text>
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
  content: { padding: 16, paddingBottom: 100 },
  hero: { backgroundColor: colors.primary, borderRadius: 24, padding: 20, marginBottom: 16 },
  heroLabel: { color: '#C7D2FE', fontSize: 13 },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginVertical: 6 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  heroSmall: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden' },
});
