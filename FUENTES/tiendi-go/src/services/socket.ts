import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'tiendigo_access_token';

/**
 * The API's rider/delivery gateway lives on this namespace (`TrackingGateway`).
 * It is part of the server contract, not environment configuration, so it lives
 * here rather than in `EXPO_PUBLIC_WS_URL` — that variable says WHERE the server
 * is, this says WHICH namespace we speak.
 *
 * Connecting without it lands on the root namespace `/`, which socket.io always
 * accepts even with no gateway attached: the connection looks healthy and every
 * server-pushed event (`order:offer`, `delivery:update`, …) is silently dropped.
 */
const WS_NAMESPACE = '/tracking';

/** Strips a trailing slash and a namespace suffix so the join can never double up. */
function resolveNamespaceUrl(base: string | undefined): string {
  const host = (base ?? 'http://localhost:4000')
    .replace(/\/+$/, '')
    .replace(new RegExp(`${WS_NAMESPACE}$`), '');
  return `${host}${WS_NAMESPACE}`;
}

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

  if (socket) {
    // Singleton exists but is disconnected — update auth token and reconnect in place
    (socket.auth as { token: string | null }).token = token;
    socket.connect();
    return socket;
  }

  socket = io(resolveNamespaceUrl(process.env.EXPO_PUBLIC_WS_URL), {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function reconnectWithToken(newToken: string): void {
  if (!socket) return;
  (socket.auth as { token: string }).token = newToken;
  socket.disconnect().connect();
}
