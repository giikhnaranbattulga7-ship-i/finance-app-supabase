import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate, formatMoney } from '../lib/format';
import { kindLabel } from '../lib/statements/classify';
import { colors } from '../lib/theme';
import { Transaction } from '../types/database';

type Props = { tx: Transaction; onPress?: () => void };

// Гүйлгээний нэг мөр. memo → props өөрчлөгдөөгүй бол дахин render хийхгүй (урт жагсаалтад хурдан)
function TransactionItemBase({ tx, onPress }: Props) {
  const isIncome = tx.type === 'income';
  const kind = tx.economic_kind ?? 'normal';
  const color = kind === 'normal' ? (tx.category?.color ?? colors.muted) : colors.transfer;
  const tags = tx.transaction_tags?.map((t) => t.tag.name) ?? [];
  const title = kind === 'normal' ? (tx.category?.name ?? 'Ангилалгүй') : kindLabel(kind);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={[styles.icon, { backgroundColor: color + '22' }]}>
        <Ionicons name={(tx.category?.icon ?? 'pricetag') as never} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {formatDate(tx.occurred_at)}{tx.posted_time ? ` ${tx.posted_time}` : ''} · {tx.account?.name ?? ''}{tx.note ? ` · ${tx.note}` : ''}
        </Text>
        {tags.length ? <Text style={styles.tags} numberOfLines={1}>#{tags.join(' #')}</Text> : null}
      </View>
      <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>
        {isIncome ? '+' : '-'}{formatMoney(Number(tx.amount))}
      </Text>
    </Pressable>
  );
}

export const TransactionItem = memo(TransactionItemBase);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 12, borderRadius: 14, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  tags: { fontSize: 11, color: colors.primary, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
