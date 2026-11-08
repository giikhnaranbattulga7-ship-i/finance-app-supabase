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
        <Stack.Screen name="profile" options={{ headerShown: true, title: 'Профайл', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerBackTitle: 'Буцах' }} />
        <Stack.Screen name="accounts" options={{ headerShown: true, title: 'Данснууд', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerBackTitle: 'Буцах' }} />
        <Stack.Screen name="transaction/[id]" options={{ headerShown: true, title: 'Гүйлгээ', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
        <Stack.Screen name="account/[id]" options={{ headerShown: true, title: 'Данс', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
        <Stack.Screen name="budget/[id]" options={{ headerShown: true, title: 'Төсөв', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
        <Stack.Screen name="categories" options={{ headerShown: true, title: 'Ангиллууд', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
        <Stack.Screen name="tags" options={{ headerShown: true, title: 'Шошгууд', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
        <Stack.Screen name="premium" options={{ headerShown: true, title: 'Premium', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
        {/* Зөвхөн админ */}
        <Stack.Protected guard={role === 'admin'}>
          <Stack.Screen name="admin" options={{ headerShown: true, title: 'Админ самбар', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
        </Stack.Protected>
      </Stack.Protected>

      {/* Нууц үг сэргээх линкээс орох дэлгэц — үргэлж нээлттэй */}
      <Stack.Screen name="reset-password" options={{ headerShown: true, title: 'Шинэ нууц үг', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
      <Stack.Screen name="preview-synthetic" options={{ headerShown: true, title: 'Синтетик харагдац', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <OfflineBanner />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <RootNavigator />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
