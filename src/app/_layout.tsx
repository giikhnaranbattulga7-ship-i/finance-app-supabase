import { Stack } from 'expo-router';

// Үндсэн layout — дараагийн алхмуудад Auth provider нэмэгдэнэ
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
