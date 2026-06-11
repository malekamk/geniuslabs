import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// SecureStore has a 2 KB per-key limit; Supabase tokens exceed that.
// This adapter chunks large values across multiple SecureStore entries.
const CHUNK_SIZE = 1800;

function chunkKey(key: string, i: number) {
  return `${key}.chunk_${i}`;
}

const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    const count = await SecureStore.getItemAsync(`${key}.chunks`);
    if (!count) return SecureStore.getItemAsync(key); // legacy single-chunk
    const chunks: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
      if (chunk == null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}.chunks`, String(chunks));
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    const count = await SecureStore.getItemAsync(`${key}.chunks`);
    if (count) {
      for (let i = 0; i < Number(count); i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
      await SecureStore.deleteItemAsync(`${key}.chunks`);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
