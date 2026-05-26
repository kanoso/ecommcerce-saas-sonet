import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'tiendigo_access_token';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

  socket = io(process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:3000', {
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
