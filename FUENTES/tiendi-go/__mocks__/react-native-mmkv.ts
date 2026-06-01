// In-memory mock for react-native-mmkv — no native module needed in tests
const stores: Record<string, Record<string, string>> = {};

export const createMMKV = ({ id }: { id: string }) => {
  if (!stores[id]) stores[id] = {};
  const store = stores[id];
  return {
    getString: (key: string) => store[key] ?? undefined,
    set: (key: string, value: string) => { store[key] = value; },
    delete: (key: string) => { delete store[key]; },
  };
};

export const MMKV = class {
  private store: Record<string, string> = {};
  getString(key: string) { return this.store[key] ?? undefined; }
  set(key: string, value: string) { this.store[key] = value; }
  delete(key: string) { delete this.store[key]; }
};
