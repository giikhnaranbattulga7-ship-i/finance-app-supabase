import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Screen } from '../components/Screen';
import { ErrorView, LoadingView } from '../components/StateViews';
import { colors, radius } from '../lib/theme';
import { listCategories } from '../services/categories';
import { Category, TxType } from '../types/database';

// Зочин горим: бүртгэлгүйгээр апп-ын боломж, үндсэн ангиллуудыг хайж/шүүж үзнэ (anon RLS)
export default function GuestScreen() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<TxType | 'all'>('all');

  useEffect(() => {
    listCategories().then(setCats).catch((e) => setError(e.message));
  }, []);

  const filtered = (cats ?? []).filter(
    (c) => (type === 'all' || c.type === type) && c.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <Screen title="Зочин горим">
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={{ color: colors.muted, marginBottom: 12 }}>
          Орлого, зарлага, төсөв, данснуудаа нэг дор хянах апп. Бүртгүүлж өөрийн өгөгдлөө хадгалаарай.
        </Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Ангилал хайх..." placeholderTextColor={colors.muted} style={styles.search} />
        <View style={{ flexDirection: 'row' }}>
          <Chip label="Бүгд" active={type === 'all'} onPress={() => setType('all')} />
          <Chip label="Орлого" active={type === 'income'} color={colors.income} onPress={() => setType('income')} />
          <Chip label="Зарлага" active={type === 'expense'} color={colors.expense} onPress={() => setType('expense')} />
        </View>
      </View>
      {error ? <ErrorView message={error} /> : !cats ? <LoadingView /> : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.tile}>
              <Ionicons name={item.icon as never} size={26} color={item.color} />
              <Text style={styles.tileText}>{item.name}</Text>
            </View>
          )}
        />
      )}
      <View style={{ padding: 16 }}>
        <Button title="Бүртгүүлэх / Нэвтрэх" onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, height: 44, paddingHorizontal: 14, marginBottom: 10, color: colors.text },
  tile: { flex: 1, margin: 4, backgroundColor: colors.card, borderRadius: 14, padding: 16, alignItems: 'center' },
  tileText: { marginTop: 6, color: colors.text, fontWeight: '500' },
});
