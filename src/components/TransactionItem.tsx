import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../lib/finance';
import { formatDate } from '../lib/format';
import { colors } from '../lib/theme';
import { Transaction } from '../types/database';

type Props = { tx: Transaction; onPress?: () => void };

function TransactionItemBase({ tx, onPress }: Props) {
  const currency = tx.account?.currency ?? 'MNT';
  const signed = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
  const tags = tx.transaction_tags?.map((t) => t.tag.name) ?? [];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tx.category?.name ?? 'Ангилалгүй'} ${formatAmount(signed, currency)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.icon}>
        <Ionicons name={(tx.category?.icon ?? 'pricetag') as never} size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{tx.category?.name ?? 'Ангилалгүй'}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {formatDate(tx.occurred_at)} · {tx.account?.name ?? ''}{tx.account?.currency ? ` · ${tx.account.currency}` : ''}{tx.note ? ` · ${tx.note}` : ''}
        </Text>
        {tags.length ? <Text style={styles.tags} numberOfLines={1}>#{tags.join(' #')}</Text> : null}
      </View>
      <Text style={styles.amount}>{formatAmount(signed, currency)}</Text>
    </Pressable>
  );
}

export const TransactionItem = memo(TransactionItemBase);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 12, borderRadius: 14, marginBottom: 8, minHeight: 48 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: colors.bg },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  tags: { fontSize: 11, color: colors.text, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', marginLeft: 8, color: colors.text },
});
