/**
 * Held outside the module factory on purpose: `jest.resetModules()` rebuilds the
 * module registry between cases, so a mock captured from the registry would go
 * stale. The `mock` name prefix is what lets babel-plugin-jest-hoist reference it
 * from inside the hoisted factory.
 */
const mockIo = jest.fn();

jest.mock('socket.io-client', () => ({ io: mockIo }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('stored.jwt'),
}));

/** `socket.ts` keeps a module-level singleton, so each case starts from a clean slate. */
function loadFreshSocketModule(): typeof import('../socket') {
  jest.resetModules();
  mockIo.mockReturnValue({ connected: false, connect: jest.fn(), auth: {} });
  return require('../socket');
}

const ORIGINAL_WS_URL = process.env.EXPO_PUBLIC_WS_URL;

describe('getSocket — tracking namespace', () => {
  afterEach(() => {
    process.env.EXPO_PUBLIC_WS_URL = ORIGINAL_WS_URL;
    mockIo.mockReset();
  });

  it('connects to the /tracking namespace, not the root namespace', async () => {
    process.env.EXPO_PUBLIC_WS_URL = 'https://api.example.test';
    const { getSocket } = loadFreshSocketModule();

    await getSocket();

    expect(mockIo).toHaveBeenCalledWith('https://api.example.test/tracking', expect.anything());
  });

  it('does not duplicate the namespace when the env var already carries it', async () => {
    process.env.EXPO_PUBLIC_WS_URL = 'https://api.example.test/tracking';
    const { getSocket } = loadFreshSocketModule();

    await getSocket();

    expect(mockIo).toHaveBeenCalledWith('https://api.example.test/tracking', expect.anything());
  });

  it('tolerates a trailing slash in the env var', async () => {
    process.env.EXPO_PUBLIC_WS_URL = 'https://api.example.test/';
    const { getSocket } = loadFreshSocketModule();

    await getSocket();

    expect(mockIo).toHaveBeenCalledWith('https://api.example.test/tracking', expect.anything());
  });

  it('namespaces the localhost fallback when the env var is absent', async () => {
    delete process.env.EXPO_PUBLIC_WS_URL;
    const { getSocket } = loadFreshSocketModule();

    await getSocket();

    expect(mockIo).toHaveBeenCalledWith('http://localhost:4000/tracking', expect.anything());
  });

  it('passes the stored access token in the handshake auth payload', async () => {
    process.env.EXPO_PUBLIC_WS_URL = 'https://api.example.test';
    const { getSocket } = loadFreshSocketModule();

    await getSocket();

    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { token: 'stored.jwt' } }),
    );
  });
});
