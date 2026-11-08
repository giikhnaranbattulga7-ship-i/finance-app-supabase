import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthShell } from '../../components/AuthShell';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../lib/theme';
import { validateEmail, validatePassword } from '../../lib/validation';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    // 1) Клиент талд шалгана
    const e = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(e);
    if (e.email || e.password) return;
    // 2) Supabase Auth руу илгээнэ. Амжилттай бол Stack.Protected автоматаар (tabs) руу шилжүүлнэ
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Z Money" subtitle="Орлого, зарлагаа гараар хянаарай">
      <Input label="Имэйл" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" error={errors.email} />
      <Input label="Нууц үг" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" error={errors.password} />
      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
      <Button title="Нэвтрэх" onPress={onSubmit} loading={loading} />
      <Link href="/forgot-password" style={styles.link}>Нууц үгээ мартсан уу?</Link>
      <View style={styles.row}>
        <Text style={{ color: colors.muted }}>Бүртгэлгүй юу? </Text>
        <Link href="/register" style={styles.linkInline}>Бүртгүүлэх</Link>
      </View>
      <Button title="Зочноор үзэх" variant="ghost" onPress={() => router.push('/guest')} style={{ marginTop: 8 }} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  formError: { color: colors.expense, marginBottom: 12, textAlign: 'center' },
  link: { color: colors.primary, textAlign: 'center', marginTop: 16, fontWeight: '500' },
  linkInline: { color: colors.primary, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
});
