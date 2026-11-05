import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingView } from '../components/StateViews';
import { OfflineBanner } from '../components/OfflineBanner';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';

// Хамгаалалттай навигаци: session болон role-оос хамаарч ямар дэлгэц нээгдэхийг шийднэ
function RootNavigator() {
  const { session, role, loading } = useAuth();
  if (loading) return <LoadingView text="Session шалгаж байна..." />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Нэвтрээгүй (зочин) үед */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="guest" />
      </Stack.Protected>

      {/* Нэвтэрсэн хэрэглэгч */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction/[id]" options={{ headerShown: true, title: 'Гүйлгээ' }} />
        <Stack.Screen name="account/[id]" options={{ headerShown: true, title: 'Данс' }} />
        <Stack.Screen name="budget/[id]" options={{ headerShown: true, title: 'Төсөв' }} />
        <Stack.Screen name="categories" options={{ headerShown: true, title: 'Ангиллууд' }} />
        <Stack.Screen name="tags" options={{ headerShown: true, title: 'Шошгууд' }} />
        <Stack.Screen name="premium" options={{ headerShown: true, title: 'Premium' }} />
        {/* Зөвхөн админ */}
        <Stack.Protected guard={role === 'admin'}>
          <Stack.Screen name="admin" options={{ headerShown: true, title: 'Админ самбар' }} />
        </Stack.Protected>
      </Stack.Protected>

      {/* Нууц үг сэргээх линкээс орох дэлгэц — үргэлж нээлттэй */}
      <Stack.Screen name="reset-password" options={{ headerShown: true, title: 'Шинэ нууц үг' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <OfflineBanner />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <RootNavigator />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
