import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { useFocusData } from '../hooks/useAsync';
import { confirmAction, showMessage } from '../lib/confirm';
import { formatDate, formatMoney } from '../lib/format';
import { colors } from '../lib/theme';
import { listImports, rollbackImport, StatementImport } from '../services/imports';

function label(item: StatementImport): string {
  const start = item.period_start ? formatDate(item.period_start) : '—';
  const end = item.period_end ? formatDate(item.period_end) : '—';
  return `${start} – ${end}`;
}

export default function StatementHistoryScreen() {
  const [busy, setBusy] = useState<string | null>(null);
  const { data, loading, error, refreshing, refresh, reload } = useFocusData(listImports);

  const rollback = (item: StatementImport) => {
    confirmAction(
      'Хуулгыг буцаах',
      `«${item.file_name}» хуулгаар орсон ${item.inserted_count} гүйлгээг устгана. Гараар бүртгэсэн гүйлгээ хэвээр үлдэнэ.`,
      async () => {
        setBusy(item.id);
        try {
          const result = await rollbackImport(item.id);
          showMessage('Буцаалаа', `${result.deleted} гүйлгээ устлаа.${result.opening_restored ? ' Эхний үлдэгдлийг сэргээсэн.' : ''}`);
          await reload();
        } catch (err) {
          showMessage('Алдаа', (err as Error).message);
        } finally {
          setBusy(null);
        }
      },
    );
  };

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => reload()} />;

  return (
    <Screen title="Хуулгын түүх" right={<Button title="Оруулах" variant="ghost" onPress={() => router.push('/statement')} style={{ height: 40 }} />}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyView icon="document-text-outline" title="Хуулга алга" subtitle="Хаан банкны PDF оруулаагүй байна" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.file_name}</Text>
            <Text style={styles.meta}>{item.account?.name ?? 'Данс'} · {label(item)}</Text>
            <Text style={styles.meta}>
              {item.status === 'rolled_back' ? 'Буцаасан' : 'Хадгалсан'} · нэмсэн {item.inserted_count} · давхардсан {item.duplicate_count}
            </Text>
            <Text style={styles.meta}>
              Эхний {item.opening_balance == null ? '—' : formatMoney(item.opening_balance)} · Эцсийн {item.closing_balance == null ? '—' : formatMoney(item.closing_balance)}
              {item.masked_account ? ` · ${item.masked_account}` : ''}
            </Text>
            {item.status === 'committed' ? (
              <Button title="Энэ хуулгыг буцаах" variant="danger" loading={busy === item.id} onPress={() => rollback(item)} style={{ marginTop: 8 }} />
            ) : null}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 800, alignSelf: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  name: { fontWeight: '700', color: colors.text, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4, fontSize: 13 },
});
