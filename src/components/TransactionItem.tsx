import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../lib/finance';
import { formatDate } from '../lib/format';
import { colors, spacing } from '../lib/theme';
import { Transaction } from '../types/database';

type Props = { tx: Transaction; onPress?: () => void };

function TransactionItemBase({ tx, onPress }: Props) {
  const currency = tx.account?.currency ?? 'MNT';
  const signed = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
  const tags = tx.transaction_tags?.map((t) => t.tag.name) ?? [];
  const detail = [formatDate(tx.occurred_at), tx.note?.trim() || tx.account?.name || ''].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tx.category?.name ?? 'Ангилалгүй'} ${formatAmount(signed, currency)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{tx.category?.name ?? 'Ангилалгүй'}</Text>
        <Text style={styles.sub} numberOfLines={1}>{detail}</Text>
        {tags.length ? <Text style={styles.tags} numberOfLines={1}>#{tags.join(' #')}</Text> : null}
      </View>
      <Text style={styles.amount}>{formatAmount(signed, currency)}</Text>
    </Pressable>
  );
}

export const TransactionItem = memo(TransactionItemBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: spacing.sm,
    minHeight: 64,
  },
  text: { flex: 1, marginRight: spacing.sm },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  tags: { fontSize: 13, color: colors.muted, marginTop: 4 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
});
