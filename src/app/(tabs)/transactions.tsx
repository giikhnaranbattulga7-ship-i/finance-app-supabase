import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip } from '../../components/Chip';
import { Fab } from '../../components/Fab';
import { Screen } from '../../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../../components/StateViews';
import { TransactionItem } from '../../components/TransactionItem';
import { monthKey, monthLabel } from '../../lib/format';
import { colors, radius } from '../../lib/theme';
import { listCategories } from '../../services/categories';
import { listTransactions, PAGE_SIZE, TxFilter } from '../../services/transactions';
import { Category, Transaction } from '../../types/database';

const SORTS: { key: NonNullable<TxFilter['sort']>; label: string }[] = [
  { key: 'date_desc', label: 'Шинэ эхэнд' },
  { key: 'date_asc', label: 'Хуучин эхэнд' },
  { key: 'amount_desc', label: 'Их дүн' },
  { key: 'amount_asc', label: 'Бага дүн' },
];

// Гүйлгээний жагсаалт: хайлт, шүүлт, эрэмбэ, infinite scroll, pull-to-refresh
export default function TransactionsScreen() {
  const focused = useIsFocused();
  const [items, setItems] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState<TxFilter['type']>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<TxFilter['sort']>('date_desc');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const requestId = useRef(0); // хуучин хүсэлтийн хариу шинийг дарахаас сэргийлнэ

  // Хайлтыг 400ms debounce хийнэ — үсэг бүрд сервер рүү хүсэлт явуулахгүй
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const filter: TxFilter = { search: debounced, type, categoryId, sort };

  const load = useCallback(async (nextPage: number, mode: 'initial' | 'more' | 'refresh') => {
    const id = ++requestId.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'more') setLoadingMore(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const rows = await listTransactions(filter, nextPage);
      if (id !== requestId.current) return;
      setItems((prev) => (nextPage === 0 ? rows : [...prev, ...rows]));
      setPage(nextPage);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false); setLoadingMore(false); setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, type, categoryId, sort]);

  // Шүүлт өөрчлөгдөх эсвэл дэлгэц рүү буцаж ирэх бүрд эхний хуудсыг ачаална
  useFocusEffect(useCallback(() => { load(0, 'initial'); }, [load]));

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  const onEndReached = () => {
    if (!hasMore || loadingMore || loading) return;
    load(page + 1, 'more');
  };

  const visibleCats = categories.filter((c) => type === 'all' || c.type === type);
  const activeSort = SORTS.find((s) => s.key === sort)?.label;
  const activeCategory = categories.find((c) => c.id === categoryId)?.name;
  const activeExtra = [sort !== 'date_desc' ? activeSort : null, activeCategory].filter(Boolean).join(' · ');

  return (
    <Screen title="Гүйлгээ">
      <View style={styles.filters}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Тэмдэглэлээр хайх..."
          placeholderTextColor={colors.muted}
          style={styles.search}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip label="Бүгд" active={type === 'all'} onPress={() => { setType('all'); setCategoryId(null); }} />
          <Chip label="Орлого" active={type === 'income'} onPress={() => { setType('income'); setCategoryId(null); }} />
          <Chip label="Зарлага" active={type === 'expense'} onPress={() => { setType('expense'); setCategoryId(null); }} />
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Эрэмбэ, ангилал" onPress={() => setShowMore((open) => !open)} style={styles.more}>
          <Text style={styles.moreText}>{showMore ? 'Шүүлтээ хаах' : 'Эрэмбэ, ангилал'}</Text>
        </Pressable>
        {!showMore && activeExtra ? <Text style={styles.active}>{activeExtra}</Text> : null}
        {showMore ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SORTS.map((s) => <Chip key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {visibleCats.map((c) => (
                <Chip key={c.id} label={c.name} active={categoryId === c.id}
                  onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>

      {loading ? <LoadingView /> : error && items.length === 0 ? (
        <ErrorView message={error} onRetry={() => load(0, 'initial')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          renderItem={({ item, index }) => {
            const grouped = sort === 'date_desc' || sort === 'date_asc';
            const previous = items[index - 1];
            const header = grouped && monthKey(item.occurred_at) !== (previous ? monthKey(previous.occurred_at) : '');
            return (
              <View>
                {header ? <Text style={styles.month}>{monthLabel(item.occurred_at)}</Text> : null}
                <TransactionItem tx={item} onPress={() => router.push(`/transaction/${item.id}`)} />
              </View>
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={() => load(0, 'refresh')}
          ListEmptyComponent={<EmptyView title="Гүйлгээ олдсонгүй" subtitle="Шүүлтээ өөрчлөх эсвэл шинэ гүйлгээ нэмнэ үү" />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : undefined}
        />
      )}
      {focused ? <Fab onPress={() => router.push('/transaction/new')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 16 },
  search: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    height: 48, paddingHorizontal: 14, marginBottom: 10, color: colors.text, fontSize: 16,
  },
  month: { color: colors.muted, fontSize: 13, marginBottom: 8, marginTop: 8 },
  more: { minHeight: 48, justifyContent: 'center', marginBottom: 8 },
  moreText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  active: { color: colors.muted, fontSize: 13, marginBottom: 8 },
});
