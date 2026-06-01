import { createMMKV } from 'react-native-mmkv';
import type { MMKV } from 'react-native-mmkv';

let _instance: MMKV | null = null;

/**
 * Returns the shared MMKV instance for rider app settings (theme, privacy flags).
 *
 * Lazy singleton so the native bridge is never called at module-load time.
 * This keeps Jest imports clean and prevents duplicate-instance warnings when
 * multiple modules import this file at the top level.
 *
 * MMKV v4 uses createMMKV() factory — `new MMKV()` is no longer valid.
 */
export function getSettingsStorage(): MMKV {
  if (_instance === null) {
    _instance = createMMKV({ id: 'settings' });
  }
  return _instance;
}
