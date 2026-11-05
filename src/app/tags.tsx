import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { useFocusData } from '../hooks/useAsync';
import { confirmAction, showMessage } from '../lib/confirm';
import { colors } from '../lib/theme';
import { validateName } from '../lib/validation';
import { createTag, deleteTag, listTags, updateTag } from '../services/tags';
import { Tag } from '../types/database';

// Шошго: гүйлгээнүүдтэй N:M холбоотой (transaction_tags)
export default function TagsScreen() {
  const { data, loading, error, reload } = useFocusData(listTags);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const e = validateName(name.replace(/^#/, ''), 30);
    setErr(e);
    if (e) return;
    setSaving(true);
    try {
      const clean = name.replace(/^#/, '');
      if (editing) await updateTag(editing.id, clean);
      else await createTag(clean);
      setName(''); setEditing(null); reload();
    } catch (er) {
      const msg = (er as Error).message;
      showMessage('Алдаа', /duplicate|unique/i.test(msg) ? 'Ийм шошго байна' : msg);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (t: Tag) =>
    confirmAction('Шошго устгах', `#${t.name} шошгыг устгах уу? Гүйлгээнүүдээс хасагдана.`, async () => {
      try { await deleteTag(t.id); reload(); } catch (er) { showMessage('Алдаа', (er as Error).message); }
    });

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={() => reload()} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(t) => t.id}
      contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center', flexGrow: 1 }}
      ListHeaderComponent={
        <Card>
          <Input label={editing ? 'Шошго засах' : 'Шинэ шошго'} value={name} onChangeText={setName} placeholder="аялал" error={err} maxLength={31} />
          <Button title={editing ? 'Хадгалах' : 'Нэмэх'} onPress={onSave} loading={saving} />
          {editing ? <Button title="Болих" variant="ghost" onPress={() => { setEditing(null); setName(''); }} /> : null}
        </Card>
      }
      ListEmptyComponent={<EmptyView icon="pricetags-outline" title="Шошго алга" subtitle="Жишээ: #аялал, #оюутан, #сар_бүр" />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.name}>#{item.name}</Text>
          <Pressable onPress={() => { setEditing(item); setName(item.name); }} hitSlop={10} style={{ marginRight: 16 }}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => onDelete(item)} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={colors.expense} />
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 14, borderRadius: 14, marginBottom: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.primary },
});
