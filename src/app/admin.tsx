import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorView, LoadingView } from '../components/StateViews';
import { useFocusData } from '../hooks/useAsync';
import { confirmAction, showMessage } from '../lib/confirm';
import { formatDate, formatMoney, monthKey } from '../lib/format';
import { colors } from '../lib/theme';
import { adminStats, setOrderStatus } from '../services/admin';

// Админ самбар: хэрэглэгч, захиалга, орлогын статистик (is_admin() policy-оор бүх мөр харагдана)
export default function AdminScreen() {
  const { data, loading, error, refreshing, refresh, reload } = useFocusData(adminStats);

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => reload()} />;
  if (!data) return null;

  // Сүүлийн 6 сарын бүртгэлийн тоо (энгийн баган график)
  const months: Record<string, number> = {};
  data.users.forEach((u) => { const k = monthKey(u.created_at); months[k] = (months[k] ?? 0) + 1; });
  const series = Object.entries(months).sort().slice(-6);
  const max = Math.max(1, ...series.map(([, v]) => v));

  const markPaid = (id: string) =>
    confirmAction('Төлөгдсөн болгох', 'Захиалгыг гараар төлөгдсөн болгох уу?', async () => {
      try { await setOrderStatus(id, 'paid'); reload(); } catch (e) { showMessage('Алдаа', (e as Error).message); }
    });

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.stats}>
        <Card style={styles.stat}><Text style={styles.statV}>{data.users.length}</Text><Text style={styles.statL}>Хэрэглэгч</Text></Card>
        <Card style={styles.stat}><Text style={styles.statV}>{data.orders.length}</Text><Text style={styles.statL}>Захиалга</Text></Card>
        <Card style={styles.stat}><Text style={styles.statV}>{data.txCount}</Text><Text style={styles.statL}>Гүйлгээ</Text></Card>
      </View>
      <Card>
        <Text style={styles.h}>Орлого (төлөгдсөн)</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.income }}>{formatMoney(data.revenue)}</Text>
      </Card>
      <Card>
        <Text style={styles.h}>Шинэ хэрэглэгч (сараар)</Text>
        <View style={styles.chart}>
          {series.map(([k, v]) => (
            <View key={k} style={styles.barCol}>
              <Text style={styles.barVal}>{v}</Text>
              <View style={[styles.bar, { height: (v / max) * 100 }]} />
              <Text style={styles.barLabel}>{k.slice(5)}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Text style={styles.h}>Захиалгууд</Text>
      {data.orders.map((o) => (
        <Card key={o.id}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{o.plan} · {formatMoney(Number(o.amount))} · {o.status}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{formatDate(o.created_at)} · {o.user_id.slice(0, 8)}</Text>
          {o.status === 'pending' ? <Button title="Төлөгдсөн болгох" variant="outline" onPress={() => markPaid(o.id)} style={{ marginTop: 8, height: 40 }} /> : null}
        </Card>
      ))}
      <Text style={styles.h}>Хэрэглэгчид</Text>
      {data.users.map((u) => (
        <View key={u.id} style={styles.userRow}>
          <Text style={{ flex: 1, color: colors.text }}>{u.full_name || '—'}</Text>
          <Text style={{ color: u.role === 'admin' ? colors.primary : colors.muted }}>{u.role}{u.is_premium ? ' · premium' : ''}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statV: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statL: { color: colors.muted, fontSize: 12 },
  h: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, justifyContent: 'space-around' },
  barCol: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 26, backgroundColor: colors.primary, borderRadius: 6, minHeight: 4 },
  barVal: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  barLabel: { fontSize: 11, color: colors.muted, marginTop: 4 },
  userRow: { flexDirection: 'row', backgroundColor: colors.card, padding: 12, borderRadius: 12, marginBottom: 6 },
});
