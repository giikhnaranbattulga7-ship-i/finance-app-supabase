import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, Role } from '../types/database';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  role: Role; // нэвтрээгүй бол 'guest'
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Supabase-ийн англи алдааг Монгол болгоно
export function authErrorMessage(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Имэйл эсвэл нууц үг буруу байна';
  if (/already registered/i.test(msg)) return 'Энэ имэйлээр бүртгэл үүссэн байна';
  if (/email not confirmed/i.test(msg)) return 'Имэйлээ баталгаажуулна уу (ирсэн линк дээр дарна)';
  if (/rate limit/i.test(msg)) return 'Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу';
  if (/network|fetch/i.test(msg)) return 'Интернэт холболтоо шалгана уу';
  return msg;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Нэвтэрсэн хэрэглэгчийн profile (role)-ийг уншина
  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) return setProfile(null);
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    // 1) Апп нээгдэхэд SecureStore-д хадгалсан session-ийг сэргээнэ
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    // 2) Нэвтрэх/гарах/token сэргээх бүрд state-ийг шинэчилнэ
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // onAuthStateChange дотор шууд await хийхгүй (deadlock-оос сэргийлнэ)
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(authErrorMessage(error.message));
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } }, // trigger profile-д бичнэ
    });
    if (error) throw new Error(authErrorMessage(error.message));
    // Имэйл баталгаажуулалт асаалттай бол session ирэхгүй
    return { needsConfirm: !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut(); // SecureStore-оос session устгагдана
  };

  const resetPassword = async (email: string) => {
    // Имэйлийн линк апп руу (financeapp://reset-password) буцаж орно
    const redirectTo = Linking.createURL('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw new Error(authErrorMessage(error.message));
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(authErrorMessage(error.message));
  };

  const role: Role = session ? profile?.role ?? 'user' : 'guest';

  return (
    <AuthContext.Provider
      value={{
        session, profile, role, loading, signIn, signUp, signOut, resetPassword, updatePassword,
        refreshProfile: () => loadProfile(session?.user.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth-г AuthProvider дотор ашиглана');
  return ctx;
}
