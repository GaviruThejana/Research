import * as SecureStore from "expo-secure-store";

/**
 * Persists the JWT between app launches.
 *
 * Uses expo-secure-store (iOS Keychain / Android Keystore) rather than
 * AsyncStorage: AsyncStorage is unencrypted, so any process with access to
 * the app's files could read a bearer token. The API is the same shape, so
 * swapping storage later only touches this file.
 */
const TOKEN_KEY = "skinai.authToken";

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (_err) {
    // Corrupted keystore entry (e.g. after an OS restore): treat as logged out.
    return null;
  }
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
}
