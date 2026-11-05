import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

// Түлхүүрийг кодод бичихгүй — .env файлаас EXPO_PUBLIC_* хувьсагчаар уншина.
// Энд зөвхөн anon (нийтийн) түлхүүр байна; service_role хэзээ ч апп-д орохгүй.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY тохируулаагүй байна (.env)');
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    storage: secureStorage, // session → SecureStore
    autoRefreshToken: true, // access token-ийг автоматаар сэргээнэ
    persistSession: true,
    detectSessionInUrl: false, // мобайлд URL-ээс session уншихгүй
    flowType: 'pkce', // нууц үг сэргээх линк ?code=... хэлбэрээр ирнэ
  },
});
