import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Input } from '../../components/Input';
import { LoadingView } from '../../components/StateViews';
import { confirmAction, showMessage } from '../../lib/confirm';
import { colors } from '../../lib/theme';
import { monthStartISO, parseAmount, validateAmount } from '../../lib/validation';
import { createBudget, deleteBudget, getBudget, updateBudget } from '../../services/budgets';
import { listCategories } from '../../services/categories';
import { Category } from '../../types/database';

export default function BudgetForm() {
  const params = useLocalSearchParams<{ id: string; month?: string }>();
  const isNew = params.id === 'new';
  const [month, setMonth] = useState(params.month ?? monthStartISO());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [limit, setLimit] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<{ limit?: string | null; category?: string | null; month?: string | null }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setCategories(await listCategories('expense'));
        if (!isNew) {
          const b = await getBudget(params.id);
          setMonth(b.month); setCategoryId(b.category_id); setLimit(String(Number(b.limit_amount)));
        }
      } catch (e) {
        showMessage('Алдаа', (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, isNew]);

  const onSave = async () => {
    const e = {
      limit: validateAmount(limit),
      category: categoryId ? null : 'Ангилал сонгоно уу',
      month: /^\d{4}-\d{2}-01$/.test(month) ? null : 'Сар YYYY-MM-01 хэлбэртэй',
    };
    setErrors(e);
    if (e.limit || e.category || e.month) return;
    setSaving(true);
    try {
      const input = { category_id: categoryId!, month, limit_amount: parseAmount(limit) };
      if (isNew) await createBudget(input);
      else await updateBudget(params.id, input);
      router.back();
    } catch (err) {
      showMessage('Хадгалж чадсангүй', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () =>
    confirmAction('Төсөв устгах', 'Энэ төсвийг устгах уу?', async () => {
      try { await deleteBudget(params.id); router.back(); } catch (err) { showMessage('Алдаа', (err as Error).message); }
    });

  if (loading) return <LoadingView />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <Stack.Screen options={{ title: isNew ? 'Шинэ төсөв' : 'Төсөв засах' }} />
      <Input label="Сар (YYYY-MM-01)" value={month} onChangeText={setMonth} error={errors.month} />
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>Зарлагын ангилал</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {categories.map((c) => <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
      </View>
      {errors.category ? <Text style={{ color: colors.expense, fontSize: 12, marginBottom: 8 }}>{errors.category}</Text> : null}
      <Input label="Сарын хязгаар (₮)" value={limit} onChangeText={setLimit} keyboardType="numeric" placeholder="300000" error={errors.limit} />
      <Button title={isNew ? 'Нэмэх' : 'Хадгалах'} onPress={onSave} loading={saving} />
      {!isNew ? <Button title="Устгах" variant="danger" onPress={onDelete} style={{ marginTop: 10 }} /> : null}
    </ScrollView>
  );
}
