import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Input } from '../../components/Input';
import { ErrorView, LoadingView } from '../../components/StateViews';
import { confirmAction, showMessage } from '../../lib/confirm';
import { colors } from '../../lib/theme';
import { parseAmount, todayISO, validateAmount, validateDate } from '../../lib/validation';
import { listAccounts } from '../../services/accounts';
import { listCategories } from '../../services/categories';
import { listTags } from '../../services/tags';
import { createTransaction, deleteTransaction, getTransaction, updateTransaction } from '../../services/transactions';
import { AccountBalance, Category, Tag, TxType } from '../../types/database';

type Errors = { amount?: string | null; date?: string | null; account?: string | null; category?: string | null; note?: string | null };

// Нэг дэлгэц хоёр горимтой: id === 'new' → нэмэх, бусад → засах/устгах
export default function TransactionForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [acc, cats, tg] = await Promise.all([listAccounts(), listCategories(), listTags()]);
        setAccounts(acc); setCategories(cats); setTags(tg);
        if (isNew) {
          setAccountId(acc[0]?.id ?? null);
        } else {
          const tx = await getTransaction(id);
          setType(tx.type);
          setAmount(String(Number(tx.amount)));
          setNote(tx.note);
          setDate(tx.occurred_at);
          setAccountId(tx.account_id);
          setCategoryId(tx.category_id);
          setTagIds(tx.transaction_tags?.map((t) => t.tag.id) ?? []);
        }
      } catch (e) {
        setLoadError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  const toggleTag = (tagId: string) =>
    setTagIds((prev) => (prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]));

  const onSave = async () => {
    const e: Errors = {
      amount: validateAmount(amount),
      date: validateDate(date),
      account: accountId ? null : 'Данс сонгоно уу',
      category: categoryId ? null : 'Ангилал сонгоно уу',
      note: note.length > 200 ? 'Тэмдэглэл 200 тэмдэгтээс ихгүй' : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    const input = {
      type, amount: parseAmount(amount), note: note.trim(), occurred_at: date,
      account_id: accountId!, category_id: categoryId, tagIds,
    };
    setSaving(true);
    try {
      if (isNew) await createTransaction(input);
      else await updateTransaction(id, input);
      router.back();
    } catch (err) {
      showMessage('Хадгалж чадсангүй', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () =>
    confirmAction('Гүйлгээ устгах', 'Энэ гүйлгээг устгахдаа итгэлтэй байна уу?', async () => {
      try {
        await deleteTransaction(id);
        router.back();
      } catch (err) {
        showMessage('Алдаа', (err as Error).message);
      }
    });

  if (loading) return <LoadingView />;
  if (loadError) return <ErrorView message={loadError} />;

  const visibleCats = categories.filter((c) => c.type === type);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isNew ? 'Шинэ гүйлгээ' : 'Гүйлгээ засах' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.segment}>
          <Chip label="Зарлага" active={type === 'expense'} color={colors.expense} onPress={() => { setType('expense'); setCategoryId(null); }} />
          <Chip label="Орлого" active={type === 'income'} color={colors.income} onPress={() => { setType('income'); setCategoryId(null); }} />
        </View>

        <Input label="Дүн (₮)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="15000" error={errors.amount} />

        <Text style={styles.label}>Данс</Text>
        {accounts.length === 0 ? (
          <Text style={styles.error}>Данс алга. Эхлээд «Данс» табаас данс нэмнэ үү.</Text>
        ) : (
          <View style={styles.wrap}>
            {accounts.map((a) => <Chip key={a.id} label={a.name} active={accountId === a.id} onPress={() => setAccountId(a.id)} />)}
          </View>
        )}
        {errors.account ? <Text style={styles.error}>{errors.account}</Text> : null}

        <Text style={styles.label}>Ангилал</Text>
        <View style={styles.wrap}>
          {visibleCats.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>
        {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

        <Input label="Огноо (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-11-05" error={errors.date} />
        <Input label="Тэмдэглэл" value={note} onChangeText={setNote} placeholder="Жишээ: өдрийн хоол" error={errors.note} maxLength={200} />

        <Text style={styles.label}>Шошго (олныг сонгож болно)</Text>
        <View style={styles.wrap}>
          {tags.length === 0 ? <Text style={{ color: colors.muted }}>Профайл → Шошгууд хэсгээс шошго үүсгэнэ</Text> : null}
          {tags.map((t) => <Chip key={t.id} label={`#${t.name}`} active={tagIds.includes(t.id)} onPress={() => toggleTag(t.id)} />)}
        </View>

        <Button title={isNew ? 'Нэмэх' : 'Хадгалах'} onPress={onSave} loading={saving} style={{ marginTop: 12 }} />
        {!isNew ? <Button title="Устгах" variant="danger" onPress={onDelete} style={{ marginTop: 10 }} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  segment: { flexDirection: 'row', marginBottom: 12 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '500' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  error: { color: colors.expense, fontSize: 12, marginBottom: 10 },
});
