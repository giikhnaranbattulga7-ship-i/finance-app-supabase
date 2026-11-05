import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Input } from '../components/Input';
import { ErrorView, LoadingView } from '../components/StateViews';
import { useFocusData } from '../hooks/useAsync';
import { confirmAction, showMessage } from '../lib/confirm';
import { colors } from '../lib/theme';
import { validateName } from '../lib/validation';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/categories';
import { Category, TxType } from '../types/database';

const PALETTE = ['#F97316', '#0EA5E9', '#8B5CF6', '#EF4444', '#EC4899', '#10B981', '#6366F1', '#F59E0B'];

// Ангилал: үндсэн (системийн) нь зөвхөн унших, өөрийн ангиллыг CRUD хийнэ
export default function CategoriesScreen() {
  const { data, loading, error, reload } = useFocusData(() => listCategories());
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<TxType>('expense');
  const [color, setColor] = useState(PALETTE[0]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setEditing(null); setName(''); setType('expense'); setColor(PALETTE[0]); setNameError(null); };

  const startEdit = (c: Category) => { setEditing(c); setName(c.name); setType(c.type); setColor(c.color); };

  const onSave = async () => {
    const e = validateName(name, 40);
    setNameError(e);
    if (e) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), type, color, icon: 'pricetag' };
      if (editing) await updateCategory(editing.id, input);
      else await createCategory(input);
      reset();
      reload();
    } catch (err) {
      const msg = (err as Error).message;
      showMessage('Алдаа', /duplicate|unique/i.test(msg) ? 'Ийм нэртэй ангилал байна' : msg);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (c: Category) =>
    confirmAction('Ангилал устгах', `«${c.name}» ангиллыг устгах уу? Холбоотой гүйлгээ «Ангилалгүй» болно.`, async () => {
      try { await deleteCategory(c.id); reload(); } catch (err) { showMessage('Алдаа', (err as Error).message); }
    });

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => reload()} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}
      ListHeaderComponent={
        <Card>
          <Text style={styles.h}>{editing ? 'Ангилал засах' : 'Шинэ ангилал'}</Text>
          <Input label="Нэр" value={name} onChangeText={setName} error={nameError} maxLength={40} />
          <View style={styles.wrap}>
            <Chip label="Зарлага" active={type === 'expense'} color={colors.expense} onPress={() => setType('expense')} />
            <Chip label="Орлого" active={type === 'income'} color={colors.income} onPress={() => setType('income')} />
          </View>
          <View style={styles.wrap}>
            {PALETTE.map((p) => (
              <Pressable key={p} onPress={() => setColor(p)} style={[styles.dot, { backgroundColor: p }, color === p && styles.dotActive]} />
            ))}
          </View>
          <Button title={editing ? 'Хадгалах' : 'Нэмэх'} onPress={onSave} loading={saving} />
          {editing ? <Button title="Болих" variant="ghost" onPress={reset} /> : null}
        </Card>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: item.color, marginRight: 10 }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>{item.type === 'income' ? 'Орлого' : 'Зарлага'} · {item.user_id ? 'Миний' : 'Үндсэн'}</Text>
          </View>
          {item.user_id ? (
            <>
              <Pressable onPress={() => startEdit(item)} hitSlop={10} style={{ marginRight: 16 }}>
                <Ionicons name="create-outline" size={22} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => onDelete(item)} hitSlop={10}>
                <Ionicons name="trash-outline" size={22} color={colors.expense} />
              </Pressable>
            </>
          ) : <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  dot: { width: 26, height: 26, borderRadius: 13, marginRight: 8 },
  dotActive: { borderWidth: 3, borderColor: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 14, borderRadius: 14, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
});
