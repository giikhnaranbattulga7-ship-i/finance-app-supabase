import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Дэлгэц focus авах бүрд өгөгдлийг дахин ачаална (өөр дэлгэцээс засаад буцахад шинэчлэгдэнэ)
export function useFocusData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, deps);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { data, loading, refreshing, error, reload: load, refresh: () => load(true) };
}
