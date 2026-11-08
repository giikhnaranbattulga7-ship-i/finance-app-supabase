import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';

// Интернэт тасарсан үед дээд талд улаан мэдэгдэл харуулна
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // addEventListener нь unsubscribe функц буцаадаг → cleanup-д дуудна
    const unsub = NetInfo.addEventListener((s) => setOffline(s.isConnected === false));
    return unsub;
  }, []);

  if (!offline) return null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <Text style={styles.text}>Интернэт холболт тасарсан байна</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.card, paddingVertical: 6, alignItems: 'center' },
  text: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
