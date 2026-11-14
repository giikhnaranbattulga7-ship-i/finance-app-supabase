import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { confirmAction, showMessage } from '../lib/confirm';
import { accountsHref } from '../lib/routes';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { validateName } from '../lib/validation';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuRow({ icon, label, href }: { icon: IconName; label: string; href: Href }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.menu} onPress={() => router.push(href)}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.menuText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session, profile, role, signOut, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    const e = validateName(name);
    setErr(e);
    if (e || !session) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', session.user.id);
    setSaving(false);
    if (error) return showMessage('Алдаа', error.message);
    await refreshProfile();
    showMessage('Хадгаллаа', 'Нэр шинэчлэгдлээ');
  };

  const onLogout = () => confirmAction('Гарах', 'Системээс гарах уу?', () => signOut());

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.full_name || 'U')[0].toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{profile?.full_name || 'Нэргүй'}</Text>
              <Text style={{ color: colors.muted }}>{session?.user.email}</Text>
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <Text style={styles.badge}>{role === 'admin' ? 'Админ' : 'Хэрэглэгч'}</Text>
                {profile?.is_premium ? <Text style={styles.badge}>Premium</Text> : null}
              </View>
            </View>
          </View>
        </Card>

        <Card>
          <Input label="Нэр солих" value={name} onChangeText={setName} error={err} />
          <Button title="Хадгалах" variant="outline" onPress={saveName} loading={saving} />
        </Card>

        <MenuRow icon="card-outline" label="Данс" href={accountsHref} />
        <MenuRow icon="pricetags-outline" label="Ангиллууд" href="/categories" />
        <MenuRow icon="bookmark-outline" label="Шошгууд" href="/tags" />
        <MenuRow icon="diamond-outline" label="Premium болох" href="/premium" />
        {role === 'admin' ? <MenuRow icon="shield-checkmark-outline" label="Админ самбар" href="/admin" /> : null}

        <Button title="Гарах" variant="danger" onPress={onLogout} style={{ marginTop: 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: colors.onAccent, fontSize: 22, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  badge: { backgroundColor: colors.primarySoft, color: colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, fontSize: 12, fontWeight: '600', marginRight: 6, overflow: 'hidden' },
  menu: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 16, minHeight: 48, marginBottom: 8 },
  menuText: { flex: 1, marginLeft: 12, fontSize: 15, color: colors.text, fontWeight: '500' },
});
