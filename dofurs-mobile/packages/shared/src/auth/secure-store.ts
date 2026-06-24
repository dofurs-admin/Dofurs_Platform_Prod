import * as SecureStore from 'expo-secure-store';

type SecureStoreAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function toNamespacedKey(namespace: string, key: string) {
  return `${namespace}.${key}`;
}

function hasNativeSecureStoreApi() {
  return (
    typeof SecureStore.getItemAsync === 'function' &&
    typeof SecureStore.setItemAsync === 'function' &&
    typeof SecureStore.deleteItemAsync === 'function'
  );
}

function getWebStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function createSecureStoreAdapter(namespace = 'dofurs.mobile'): SecureStoreAdapter {
  return {
    async getItem(key) {
      const namespacedKey = toNamespacedKey(namespace, key);
      const storage = getWebStorage();

      if (hasNativeSecureStoreApi()) {
        try {
          return await SecureStore.getItemAsync(namespacedKey);
        } catch {
          // Expo web secure-store can throw at runtime if native backing APIs are unavailable.
          return storage ? storage.getItem(namespacedKey) : null;
        }
      }

      return storage ? storage.getItem(namespacedKey) : null;
    },
    async setItem(key, value) {
      const namespacedKey = toNamespacedKey(namespace, key);
      const storage = getWebStorage();

      if (hasNativeSecureStoreApi()) {
        try {
          await SecureStore.setItemAsync(namespacedKey, value);
          return;
        } catch {
          if (storage) {
            storage.setItem(namespacedKey, value);
          }
          return;
        }
      }

      if (storage) {
        storage.setItem(namespacedKey, value);
      }
    },
    async removeItem(key) {
      const namespacedKey = toNamespacedKey(namespace, key);
      const storage = getWebStorage();

      if (hasNativeSecureStoreApi()) {
        try {
          await SecureStore.deleteItemAsync(namespacedKey);
          return;
        } catch {
          if (storage) {
            storage.removeItem(namespacedKey);
          }
          return;
        }
      }

      if (storage) {
        storage.removeItem(namespacedKey);
      }
    },
  };
}
