import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../../components/StateViews';
import { TransactionItem } from '../../components/TransactionItem';
import { useAuth } from '../../context/AuthContext';
import { useFocusData } from '../../hooks/useAsync';
import { formatMoney } from '../../lib/format';
import { formatCents } from '../../lib/money';
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
  const cats = Object.values(data.summary.byCategory).sort((a, b) => b.totalCents - a.totalCents).slice(0, 5);
  const max = cats[0]?.totalCents ?? 1;
  const side = data.summary;
  const moneyIn = side.incomeCents + side.transferInCents + side.savingsInCents + side.refundCents + side.unclassifiedInCents;
  const moneyOut = side.expenseCents + side.transferOutCents + side.savingsOutCents + side.unclassifiedOutCents;

  return (
    <Screen title={`Сайн уу, ${profile?.full_name || 'хэрэглэгч'} 👋`}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Button title="Хуулга оруулах" onPress={() => router.push('/statement')} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/transaction/new')} style={{ marginTop: 8, marginBottom: 16 }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Гараар нэмэх</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Нийт үлдэгдэл</Text>
          <Text style={styles.heroValue}>{formatMoney(total)}</Text>
          <Text style={styles.heroNote}>Жинхэнэ орлого, зарлагад шилжүүлэг, хадгаламж, буцаалт, ангилаагүй мөр орохгүй.</Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>Жинхэнэ орлого</Text>
              <Text style={styles.heroSmall}>+{formatCents(side.incomeCents)}</Text>
            </View>
            <View>
              <Text style={styles.heroLabel}>Жинхэнэ зарлага</Text>
              <Text style={styles.heroSmall}>-{formatCents(side.expenseCents)}</Text>
            </View>
          </View>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>Дансанд орсон</Text>
              <Text style={styles.heroSmall}>+{formatCents(moneyIn)}</Text>
            </View>
            <View>
              <Text style={styles.heroLabel}>Данснаас гарсан</Text>
              <Text style={styles.heroSmall}>-{formatCents(moneyOut)}</Text>
            </View>
          </View>
        </View>

        {data.accounts.length === 0 ? (
          <Card>
            <Text style={styles.section}>Эхлэх</Text>
            <Text style={{ color: colors.muted }}>Эхлээд Бусад → Данс хэсгээс данс нэмнэ үү. Дараа нь хуулга оруулна.</Text>
          </Card>
        ) : null}

        <Card>
          <Text style={styles.section}>Жинхэнэ зарлага ангиллаар</Text>
          {cats.length === 0 ? <Text style={{ color: colors.muted }}>Энэ сард зарлага алга</Text> : null}
          {cats.map((c) => (
            <View key={c.name} style={{ marginBottom: 10 }}>
              <View style={styles.barLabel}>
                <Text style={{ color: colors.text }}>{c.name}</Text>
                <Text style={{ color: colors.muted }}>{formatCents(c.totalCents)}</Text>
              </View>
              <View style={styles.track}>
                <View style={{ width: `${(c.totalCents / max) * 100}%`, height: '100%', backgroundColor: c.color, borderRadius: 999 }} />
              </View>
            </View>
          ))}
        </Card>

        {side.transferInCents || side.transferOutCents || side.savingsInCents || side.savingsOutCents || side.refundCents || side.unclassifiedInCents || side.unclassifiedOutCents ? (
          <Card>
            <Text style={styles.section}>Тайланд ороогүй</Text>
            {side.transferInCents || side.transferOutCents ? <Text style={styles.note}>Шилжүүлэг: орсон {formatCents(side.transferInCents)}, гарсан {formatCents(side.transferOutCents)}</Text> : null}
            {side.savingsInCents || side.savingsOutCents ? <Text style={styles.note}>Хадгаламж: орсон {formatCents(side.savingsInCents)}, гарсан {formatCents(side.savingsOutCents)}</Text> : null}
            {side.refundCents ? <Text style={styles.note}>Буцаалт: {formatCents(side.refundCents)}</Text> : null}
            {side.unclassifiedInCents || side.unclassifiedOutCents ? <Text style={styles.note}>Ангилаагүй: орсон {formatCents(side.unclassifiedInCents)}, гарсан {formatCents(side.unclassifiedOutCents)}</Text> : null}
          </Card>
        ) : null}

        <Text style={[styles.section, { marginTop: 8 }]}>Сүүлийн гүйлгээ</Text>
        {data.recent.length === 0 ? <EmptyView title="Гүйлгээ алга" subtitle="Хуулга оруулах эсвэл гараар нэмнэ үү" /> : null}
        {data.recent.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} onPress={() => router.push(`/transaction/${tx.id}`)} />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  hero: { backgroundColor: colors.primary, borderRadius: 24, padding: 20, marginBottom: 16 },
  heroLabel: { color: '#C7D2FE', fontSize: 13 },
  heroNote: { color: '#E0E7FF', fontSize: 13, marginTop: 4 },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginVertical: 6 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  heroSmall: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  note: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden' },
});
