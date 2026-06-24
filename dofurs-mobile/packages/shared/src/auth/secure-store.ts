import * as SecureStore from 'expo-secure-store';

type SecureStoreAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function toNamespacedKey(namespace: string, key: string) {
  return `${namespace}.${key}`;
}

export function createSecureStoreAdapter(namespace = 'dofurs.mobile'): SecureStoreAdapter {
  return {
    async getItem(key) {
      return SecureStore.getItemAsync(toNamespacedKey(namespace, key));
    },
    async setItem(key, value) {
      await SecureStore.setItemAsync(toNamespacedKey(namespace, key), value);
    },
    async removeItem(key) {
      await SecureStore.deleteItemAsync(toNamespacedKey(namespace, key));
    },
  };
}
