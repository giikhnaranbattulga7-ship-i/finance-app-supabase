import { router, useIsFocused } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fab } from '../../components/Fab';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../../components/StateViews';
import { useFocusData } from '../../hooks/useAsync';
import { budgetRemaining, formatAmount } from '../../lib/finance';
import { colors } from '../../lib/theme';
import { monthStartISO } from '../../lib/validation';
import { listBudgets } from '../../services/budgets';
import { monthSummary } from '../../services/transactions';

const MONTHS = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];

// Сарын төсөв ба зарцуулалт (ангилал бүрээр)
export default function BudgetsScreen() {
  const focused = useIsFocused();
  const [cursor, setCursor] = useState(new Date());
  const month = monthStartISO(cursor);

  const { data, loading, error, refreshing, refresh, reload } = useFocusData(async () => {
    const [budgets, summary] = await Promise.all([listBudgets(month), monthSummary(month)]);
    const progress = budgetRemaining(budgets.map((b) => ({
      limit: Number(b.limit_amount),
      spent: summary.byCategory[b.category_id]?.total ?? 0,
    })));
    return budgets.map((b, index) => ({ ...b, ...progress.lines[index] }));
  }, [month]);

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <Screen title="Төсөв">
      <View style={styles.monthBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Өмнөх сар" onPress={() => shift(-1)} style={styles.arrow}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={styles.month}>{cursor.getFullYear()} оны {MONTHS[cursor.getMonth()]}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Дараагийн сар" onPress={() => shift(1)} style={styles.arrow}><Ionicons name="chevron-forward" size={24} color={colors.text} /></Pressable>
      </View>
      {loading && !data ? <LoadingView /> : error ? <ErrorView message={error} onRetry={() => reload()} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={(b) => b.id}
          refreshing={refreshing}
          onRefresh={refresh}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}
          ListEmptyComponent={<EmptyView icon="pie-chart-outline" title="Төсөв алга" subtitle="+ товчоор ангилал тус бүрт сарын хязгаар тогтооно" />}
          renderItem={({ item }) => {
            const ratio = Number(item.limit_amount) === 0 ? 0 : item.spent / Number(item.limit_amount);
            const status = item.over
              ? `Хэтэрсэн ${formatAmount(item.remaining, 'MNT')}`
              : `${formatAmount(item.remaining, 'MNT')} үлдсэн`;
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.category?.name ?? 'Ангилал'} ${status}`} style={styles.card} onPress={() => router.push(`/budget/${item.id}`)}>
                <Text style={styles.name}>{item.category?.name}</Text>
                <Text style={styles.left}>{status}</Text>
                <ProgressBar value={ratio} />
                <Text style={styles.sub}>{formatAmount(item.spent, 'MNT')} зарцуулсан / {formatAmount(Number(item.limit_amount), 'MNT')}</Text>
              </Pressable>
            );
          }}
        />
      )}
      {focused ? <Fab onPress={() => router.push({ pathname: '/budget/[id]', params: { id: 'new', month } })} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 14, padding: 4 },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 16, fontWeight: '600', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  left: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 10 },
});
