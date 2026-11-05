import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthShell } from '../../components/AuthShell';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { showMessage } from '../../lib/confirm';
import { colors } from '../../lib/theme';
import { validateEmail, validateName, validatePassword } from '../../lib/validation';

type Errors = { name?: string | null; email?: string | null; password?: string | null; confirm?: string | null; form?: string };

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const e: Errors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: password !== confirm ? 'Нууц үг таарахгүй байна' : null,
    };
    setErrors(e);
    if (e.name || e.email || e.password || e.confirm) return;
    setLoading(true);
    try {
      const { needsConfirm } = await signUp(email, password, name);
      if (needsConfirm) {
        showMessage('Бүртгэл үүслээ', 'Имэйл рүү ирсэн линкээр баталгаажуулаад нэвтэрнэ үү.');
        router.replace('/login');
      }
      // needsConfirm=false бол session шууд үүсэж, (tabs) руу автоматаар орно
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Бүртгүүлэх" subtitle="Шинэ бүртгэл үүсгээд санхүүгээ хянаж эхлээрэй">
      <Input label="Нэр" value={name} onChangeText={setName} placeholder="Бат-Эрдэнэ" error={errors.name} />
      <Input label="Имэйл" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" error={errors.email} />
      <Input label="Нууц үг" value={password} onChangeText={setPassword} secureTextEntry placeholder="6+ тэмдэгт" error={errors.password} />
      <Input label="Нууц үг давтах" value={confirm} onChangeText={setConfirm} secureTextEntry error={errors.confirm} />
      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
      <Button title="Бүртгүүлэх" onPress={onSubmit} loading={loading} />
      <View style={styles.row}>
        <Text style={{ color: colors.muted }}>Бүртгэлтэй юу? </Text>
        <Link href="/login" style={{ color: colors.primary, fontWeight: '600' }}>Нэвтрэх</Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  formError: { color: colors.expense, marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
});
