import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fab } from '../components/Fab';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { useFocusData } from '../hooks/useAsync';
import { formatAmount, sumByCurrency } from '../lib/finance';
import { ACCOUNT_TYPES, accountTypeLabel } from '../lib/labels';
import { colors } from '../lib/theme';
import { listAccounts } from '../services/accounts';

export default function AccountsScreen() {
  const focused = useIsFocused();
  const { data, loading, error, refreshing, refresh, reload } = useFocusData(listAccounts);

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => reload()} />;
  const totals = sumByCurrency((data ?? []).map((account) => ({ currency: account.currency, amount: Number(account.balance) })));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(a) => a.id}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={styles.total}>
            <Text style={{ color: colors.muted }}>Валют бүрээр</Text>
            {totals.length === 0 ? <Text style={styles.totalValue}>Данс алга</Text> : totals.map((row) => (
              <Text key={row.currency} style={styles.totalValue}>{formatAmount(row.total, row.currency)}</Text>
            ))}
          </View>
        }
        ListEmptyComponent={<EmptyView icon="card-outline" title="Данс алга" subtitle="+ товчоор бэлэн мөнгө, карт зэрэг дансаа нэмнэ үү" />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/account/${item.id}`)}>
            <View style={styles.icon}>
              <Ionicons name={(ACCOUNT_TYPES.find((t) => t.key === item.type)?.icon ?? 'wallet') as never} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{accountTypeLabel(item.type)}</Text>
            </View>
            <Text style={styles.balance}>{formatAmount(Number(item.balance), item.currency)}</Text>
          </Pressable>
        )}
      />
      {focused ? <Fab onPress={() => router.push('/account/new')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  total: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  totalValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 8 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  balance: { fontSize: 16, fontWeight: '700' },
});
