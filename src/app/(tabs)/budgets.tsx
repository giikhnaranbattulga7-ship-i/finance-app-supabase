import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fab } from '../../components/Fab';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../../components/StateViews';
import { useFocusData } from '../../hooks/useAsync';
import { formatMoney } from '../../lib/format';
import { formatCents, numberToCents } from '../../lib/money';
import { colors } from '../../lib/theme';
import { monthStartISO } from '../../lib/validation';
import { listBudgets } from '../../services/budgets';
import { monthSummary } from '../../services/transactions';

const MONTHS = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];

// Сарын төсөв ба зарцуулалт (ангилал бүрээр)
export default function BudgetsScreen() {
  const [cursor, setCursor] = useState(new Date());
  const month = monthStartISO(cursor);

  const { data, loading, error, refreshing, refresh, reload } = useFocusData(async () => {
    const [budgets, summary] = await Promise.all([listBudgets(month), monthSummary(month)]);
    return budgets.map((b) => ({ ...b, spentCents: summary.byCategory[b.category_id]?.totalCents ?? 0 }));
  }, [month]);

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <Screen title="Төсөв">
      <View style={styles.monthBar}>
        <Pressable onPress={() => shift(-1)} hitSlop={12}><Ionicons name="chevron-back" size={24} color={colors.primary} /></Pressable>
        <Text style={styles.month}>{cursor.getFullYear()} оны {MONTHS[cursor.getMonth()]}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={12}><Ionicons name="chevron-forward" size={24} color={colors.primary} /></Pressable>
      </View>
      {loading && !data ? <LoadingView /> : error ? <ErrorView message={error} onRetry={() => reload()} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={(b) => b.id}
          refreshing={refreshing}
          onRefresh={refresh}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}
          ListEmptyComponent={<EmptyView icon="pie-chart-outline" title="Энэ сард төсөв алга" subtitle="+ товчоор ангилал тус бүрт сарын хязгаар тогтооно" />}
          renderItem={({ item }) => {
            const limitCents = numberToCents(item.limit_amount);
            const ratio = limitCents > 0 ? item.spentCents / limitCents : 0;
            return (
              <Pressable style={styles.card} onPress={() => router.push(`/budget/${item.id}`)}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.category?.name}</Text>
                  <Text style={{ color: ratio > 1 ? colors.expense : colors.muted }}>{Math.round(ratio * 100)}%</Text>
                </View>
                <ProgressBar value={ratio} color={item.category?.color} />
                <Text style={styles.sub}>
                  {formatCents(item.spentCents)} / {formatMoney(Number(item.limit_amount))}
                  {ratio > 1 ? '  · Хэтэрсэн!' : `  · Үлдсэн ${formatCents(Math.max(0, limitCents - item.spentCents))}`}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
      <Fab onPress={() => router.push({ pathname: '/budget/[id]', params: { id: 'new', month } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 14, padding: 12 },
  month: { fontSize: 16, fontWeight: '600', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 8 },
});
