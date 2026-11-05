import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { showMessage } from '../lib/confirm';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { validatePassword } from '../lib/validation';

// Имэйлийн линк financeapp://reset-password?code=XXX хэлбэрээр апп-ыг нээнэ.
// code-г session болгон солиод (PKCE), шинэ нууц үг тохируулна.
export default function ResetPasswordScreen() {
  const { updatePassword, session } = useAuth();
  const url = Linking.useURL();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    const { queryParams } = Linking.parse(url);
    const code = queryParams?.code;
    if (typeof code === 'string') {
      supabase.auth.exchangeCodeForSession(code).then(({ error: e }) => e && setError(e.message));
    }
  }, [url]);

  const onSubmit = async () => {
    const e = validatePassword(password);
    setError(e);
    if (e) return;
    setLoading(true);
    try {
      await updatePassword(password);
      showMessage('Амжилттай', 'Нууц үг шинэчлэгдлээ');
      router.replace('/home');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      {!session ? (
        <Text style={{ color: colors.muted, marginBottom: 16 }}>
          Сэргээх линкээ имэйлээс нээнэ үү. Линк баталгаажсаны дараа шинэ нууц үг оруулах боломжтой.
        </Text>
      ) : null}
      <Input label="Шинэ нууц үг" value={password} onChangeText={setPassword} secureTextEntry error={error} />
      <Button title="Хадгалах" onPress={onSubmit} loading={loading} disabled={!session} />
    </ScrollView>
  );
}
