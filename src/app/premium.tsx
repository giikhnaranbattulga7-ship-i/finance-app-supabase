import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingView } from '../components/StateViews';
import { useFocusData } from '../hooks/useAsync';
import { formatDate, formatMoney } from '../lib/format';
import { confirmAction, showMessage } from '../lib/confirm';
import { colors } from '../lib/theme';
import { createOrder, listMyOrders, PLANS } from '../services/premium';

const STATUS = { pending: 'Хүлээгдэж буй', paid: 'Төлөгдсөн', cancelled: 'Цуцлагдсан' } as const;

// Premium захиалга. Хамгаалалт-2-т QPay sandbox + webhook-оор төлөв 'paid' болно.
export default function PremiumScreen() {
  const { data, loading, reload } = useFocusData(listMyOrders);
  const [busy, setBusy] = useState(false);

  const order = (plan: keyof typeof PLANS) =>
    confirmAction('Захиалга үүсгэх', `${PLANS[plan].title} багц — ${formatMoney(PLANS[plan].price)}`, async () => {
      setBusy(true);
      try {
        await createOrder(plan);
        showMessage('Захиалга үүслээ', 'Төлөв: Хүлээгдэж буй. QPay төлбөр Хамгаалалт-2-т холбогдоно.');
        reload();
      } catch (e) {
        showMessage('Алдаа', (e as Error).message);
      } finally {
        setBusy(false);
      }
    });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <Card style={{ backgroundColor: colors.primary }}>
        <Text style={styles.heroTitle}>Premium</Text>
        <Text style={styles.heroText}>• Хязгааргүй төсөв ба шошго{'\n'}• Сарын PDF тайлан{'\n'}• Баримтын зураг хадгалах</Text>
      </Card>
      {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((p) => (
        <Card key={p}>
          <Text style={styles.plan}>{PLANS[p].title} багц</Text>
          <Text style={styles.price}>{formatMoney(PLANS[p].price)}</Text>
          <Button title="Захиалах" onPress={() => order(p)} loading={busy} />
        </Card>
      ))}
      <Text style={styles.h}>Миний захиалгууд</Text>
      {loading && !data ? <LoadingView /> : null}
      {data?.length === 0 ? <Text style={{ color: colors.muted }}>Захиалга алга</Text> : null}
      {data?.map((o) => (
        <View key={o.id} style={styles.row}>
          <Text style={{ flex: 1, color: colors.text }}>{PLANS[o.plan].title} · {formatDate(o.created_at)}</Text>
          <Text style={{ color: o.status === 'paid' ? colors.income : colors.warning, fontWeight: '600' }}>{STATUS[o.status]}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 6 },
  heroText: { color: '#E0E7FF', lineHeight: 22 },
  plan: { fontSize: 16, fontWeight: '600', color: colors.text },
  price: { fontSize: 26, fontWeight: '800', color: colors.primary, marginVertical: 8 },
  h: { fontSize: 16, fontWeight: '700', marginVertical: 10, color: colors.text },
  row: { flexDirection: 'row', backgroundColor: colors.card, padding: 14, borderRadius: 12, marginBottom: 8 },
});
