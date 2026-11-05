import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Supabase-ийн session-ийг төхөөрөмж дээр аюулгүй хадгалах adapter.
// iOS → Keychain, Android → Keystore (expo-secure-store).
// SecureStore нэг утгад ~2048 байт хязгаартай тул урт JWT-г хэсэглэж (chunk) хадгална.
const CHUNK = 1800;

// SecureStore-ийн түлхүүр зөвхөн [A-Za-z0-9._-] тэмдэгт зөвшөөрнө
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

const webStorage = {
  getItem: async (k: string) => (typeof window === 'undefined' ? null : window.localStorage.getItem(k)),
  setItem: async (k: string, v: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(k, v);
  },
  removeItem: async (k: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(k);
  },
};

const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.count`);
    if (!count) return null;
    let value = '';
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`);
      if (part == null) return null;
      value += part;
    }
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    await nativeStorage.removeItem(key);
    const parts = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < parts; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${k}.count`, String(parts));
  },
  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.count`);
    for (let i = 0; i < Number(count ?? 0); i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    await SecureStore.deleteItemAsync(`${k}.count`);
  },
};

// Web дээр SecureStore байхгүй тул localStorage ашиглана (зөвхөн demo-д)
export const secureStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
