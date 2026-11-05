import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

// Интернэт тасарсан үед дээд талд улаан мэдэгдэл харуулна
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // addEventListener нь unsubscribe функц буцаадаг → cleanup-д дуудна
    const unsub = NetInfo.addEventListener((s) => setOffline(s.isConnected === false));
    return unsub;
  }, []);

  if (!offline) return null;
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>Интернэт холболт тасарсан байна</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.expense, paddingVertical: 6, alignItems: 'center' },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
