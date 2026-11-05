import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { AuthShell } from '../../components/AuthShell';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../lib/theme';
import { validateEmail } from '../../lib/validation';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const e = validateEmail(email);
    setError(e);
    if (e) return;
    setLoading(true);
    try {
      await resetPassword(email); // Supabase сэргээх линктэй имэйл илгээнэ
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Нууц үг сэргээх" subtitle="Бүртгэлтэй имэйлээ оруулбал сэргээх линк илгээнэ">
      {sent ? (
        <Text style={{ color: colors.income, textAlign: 'center', marginBottom: 16 }}>
          Линк илгээлээ. Имэйлээ шалгаад линк дээр дарна уу.
        </Text>
      ) : (
        <>
          <Input label="Имэйл" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} />
          <Button title="Линк илгээх" onPress={onSubmit} loading={loading} />
        </>
      )}
      <Link href="/login" style={{ color: colors.primary, textAlign: 'center', marginTop: 16 }}>← Нэвтрэх рүү буцах</Link>
    </AuthShell>
  );
}
