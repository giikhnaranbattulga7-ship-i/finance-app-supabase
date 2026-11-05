import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Input } from '../../components/Input';
import { LoadingView } from '../../components/StateViews';
import { confirmAction, showMessage } from '../../lib/confirm';
import { ACCOUNT_TYPES } from '../../lib/labels';
import { colors } from '../../lib/theme';
import { parseAmount, validateAmount, validateName } from '../../lib/validation';
import { createAccount, deleteAccount, getAccount, updateAccount } from '../../services/accounts';
import { AccountType } from '../../types/database';

export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [initial, setInitial] = useState('0');
  const [errors, setErrors] = useState<{ name?: string | null; initial?: string | null }>({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getAccount(id)
      .then((a) => { setName(a.name); setType(a.type); setInitial(String(Number(a.initial_balance))); })
      .catch((e) => showMessage('Алдаа', e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const onSave = async () => {
    const e = { name: validateName(name), initial: validateAmount(initial, true) };
    setErrors(e);
    if (e.name || e.initial) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), type, initial_balance: parseAmount(initial) };
      if (isNew) await createAccount(input);
      else await updateAccount(id, input);
      router.back();
    } catch (err) {
      showMessage('Хадгалж чадсангүй', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () =>
    confirmAction('Данс устгах', 'Энэ дансны бүх гүйлгээ хамт устна. Итгэлтэй байна уу?', async () => {
      try { await deleteAccount(id); router.back(); } catch (err) { showMessage('Алдаа', (err as Error).message); }
    });

  if (loading) return <LoadingView />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <Stack.Screen options={{ title: isNew ? 'Шинэ данс' : 'Данс засах' }} />
      <Input label="Дансны нэр" value={name} onChangeText={setName} placeholder="Хаан банк" error={errors.name} maxLength={50} />
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>Төрөл</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {ACCOUNT_TYPES.map((t) => <Chip key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} />)}
      </View>
      <Input label="Эхний үлдэгдэл (₮)" value={initial} onChangeText={setInitial} keyboardType="numeric" error={errors.initial} />
      <Button title={isNew ? 'Нэмэх' : 'Хадгалах'} onPress={onSave} loading={saving} />
      {!isNew ? <Button title="Устгах" variant="danger" onPress={onDelete} style={{ marginTop: 10 }} /> : null}
    </ScrollView>
  );
}
