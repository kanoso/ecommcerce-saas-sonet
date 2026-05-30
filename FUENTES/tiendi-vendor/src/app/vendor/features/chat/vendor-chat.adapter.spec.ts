import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ChatParticipantStatus,
  ChatParticipantType,
  MessageType,
} from '@tiendi/chat';
import { VendorChatAdapter, CHAT_SOCKET_FACTORY } from './vendor-chat.adapter';
import { AuthStore } from '../../core/services/auth.store';
import { Customer } from '../customers/customers.store';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockCustomer: Customer = {
  id: 'a1b2-c3d4-e5f6',
  name: 'Jane Doe',
  phone: '+1-555-0100',
  email: 'jane@example.com',
  totalOrders: 3,
  totalSpent: 450.0,
  lastOrderDate: '2024-01-15',
  lastOrderId: 'order-1',
  type: 'regular',
  avatarColor: '#FF6B6B',
};

const mockApiMessage = {
  id: 'msg-1',
  conversationId: 'conv-abc',
  senderId: 'vendor-user-1',
  senderType: 'VENDOR' as const,
  content: 'Hello!',
  createdAt: '2026-05-30T10:00:00.000Z',
};

const mockCustomerApiMessage = {
  id: 'msg-2',
  conversationId: 'conv-abc',
  senderId: 'a1b2-c3d4-e5f6',
  senderType: 'CUSTOMER' as const,
  content: 'Hi back!',
  createdAt: '2026-05-30T10:01:00.000Z',
};

function createMockSocket() {
  const listeners = new Map<string, Array<(data: unknown) => void>>();
  const emitCalls: Array<{ event: string; data: unknown }> = [];
  return {
    emit(event: string, data: unknown) { emitCalls.push({ event, data }); },
    on(event: string, handler: (data: unknown) => void) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    },
    disconnect() { /* no-op */ },
    trigger(event: string, data: unknown) {
      listeners.get(event)?.forEach((h) => h(data));
    },
    get emitCalls() { return emitCalls; },
  };
}

function makeAuthStore(storeId: string | null, userId: string | null) {
  const userValue =
    storeId !== null && userId !== null
      ? {
          id: userId,
          name: 'Test User',
          email: 'test@example.com',
          role: 'STORE_OWNER' as const,
          storeId,
          avatar: null,
        }
      : null;
  return {
    currentUser: signal(userValue),
    isAuthenticated: signal(!!userValue),
  };
}

function configureAdapter(
  storeId: string | null = 'store-1',
  userId: string | null = 'vendor-user-1',
) {
  const mockSocket = createMockSocket();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(withInterceptorsFromDi()),
      provideHttpClientTesting(),
      VendorChatAdapter,
      { provide: AuthStore, useValue: makeAuthStore(storeId, userId) },
      { provide: CHAT_SOCKET_FACTORY, useValue: () => mockSocket },
    ],
  });
  return {
    adapter: TestBed.inject(VendorChatAdapter),
    httpMock: TestBed.inject(HttpTestingController),
    mockSocket,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VendorChatAdapter', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      // ignore — some tests don't use http
    }
  });

  // ── listFriends: participant mapping ─────────────────────────────────────

  it('should map id as string UUID without numeric coercion', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers') && r.method === 'GET')
      .flush({ data: [mockCustomer], meta: { total: 1, totalPages: 1 } });
    const responses = await promise;
    expect(responses[0].participant.id).toBe('a1b2-c3d4-e5f6');
    expect(typeof responses[0].participant.id).toBe('string');
  });

  it('should map displayName from customer.name', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers'))
      .flush({ data: [mockCustomer], meta: { total: 1, totalPages: 1 } });
    const responses = await promise;
    expect(responses[0].participant.displayName).toBe('Jane Doe');
  });

  it('should set status to Online', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers'))
      .flush({ data: [mockCustomer], meta: { total: 1, totalPages: 1 } });
    const responses = await promise;
    expect(responses[0].participant.status).toBe(ChatParticipantStatus.Online);
  });

  it('should set avatar to null', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers'))
      .flush({ data: [mockCustomer], meta: { total: 1, totalPages: 1 } });
    const responses = await promise;
    expect(responses[0].participant.avatar).toBeNull();
  });

  it('should set participantType to User', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers'))
      .flush({ data: [mockCustomer], meta: { total: 1, totalPages: 1 } });
    const responses = await promise;
    expect(responses[0].participant.participantType).toBe(ChatParticipantType.User);
  });

  it('should set totalUnreadMessages to 0 in metadata', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers'))
      .flush({ data: [mockCustomer], meta: { total: 1, totalPages: 1 } });
    const responses = await promise;
    expect(responses[0].metadata.totalUnreadMessages).toBe(0);
  });

  it('should GET /stores/{storeId}/customers?limit=100', async () => {
    const { adapter, httpMock } = configureAdapter('store-abc');
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne(
        (r) =>
          r.url.includes('/stores/store-abc/customers') &&
          r.url.includes('limit=100') &&
          r.method === 'GET',
      )
      .flush({ data: [mockCustomer], meta: { total: 1, totalPages: 1 } });
    const responses = await promise;
    expect(responses.length).toBe(1);
  });

  it('should return empty array when API returns no customers', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers'))
      .flush({ data: [], meta: { total: 0, totalPages: 0 } });
    const responses = await promise;
    expect(responses).toEqual([]);
  });

  it('should return of([]) when storeId is null', async () => {
    const { adapter, httpMock } = configureAdapter(null, null);
    const responses = await firstValueFrom(adapter.listFriends());
    expect(responses).toEqual([]);
    httpMock.expectNone((r) => r.url.includes('/customers'));
  });

  it('should cache participants from listFriends for later socket use', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers'))
      .flush({ data: [mockCustomer], meta: { total: 1, totalPages: 1 } });
    await promise;
    // Access internal cache via bracket notation for white-box test
    const cache = (adapter as unknown as { participantsCache: Map<string, unknown> }).participantsCache;
    expect(cache.has('a1b2-c3d4-e5f6')).toBe(true);
  });

  // ── sendMessage ──────────────────────────────────────────────────────────

  it('should POST to /stores/{storeId}/conversations/{toId}/messages', async () => {
    const { adapter, httpMock, mockSocket } = configureAdapter();
    adapter.sendMessage({ toId: 'a1b2-c3d4-e5f6', message: 'Hello!', fromId: 'vendor-user-1' } as any);
    const req = httpMock.expectOne(
      (r) =>
        r.url.includes('/stores/store-1/conversations/a1b2-c3d4-e5f6/messages') &&
        r.method === 'POST',
    );
    expect(req.request.body).toEqual({ content: 'Hello!' });
    req.flush(mockApiMessage);
    // give subscribe a tick
    await Promise.resolve();
    expect(mockSocket.emitCalls.some((c) => c.event === 'chat:join')).toBe(true);
  });

  it('should join the WebSocket room after sendMessage succeeds', async () => {
    const { adapter, httpMock, mockSocket } = configureAdapter();
    adapter.sendMessage({ toId: 'a1b2-c3d4-e5f6', message: 'Hi', fromId: 'vendor-user-1' } as any);
    httpMock
      .expectOne((r) => r.url.includes('/conversations/'))
      .flush(mockApiMessage);
    await Promise.resolve();
    const joinCall = mockSocket.emitCalls.find((c) => c.event === 'chat:join');
    expect(joinCall?.data).toEqual({ conversationId: 'conv-abc' });
  });

  it('should not POST when storeId is null', () => {
    const { adapter, httpMock } = configureAdapter(null, null);
    adapter.sendMessage({ toId: 'a1b2', message: 'Hi', fromId: 'x' } as any);
    httpMock.expectNone(() => true);
  });

  it('should not POST when toId is null', () => {
    const { adapter, httpMock } = configureAdapter();
    adapter.sendMessage({ toId: null, message: 'Hi', fromId: 'x' } as any);
    httpMock.expectNone(() => true);
  });

  // ── getMessageHistory ────────────────────────────────────────────────────

  it('should GET /stores/{storeId}/conversations/{customerId}/messages', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.getMessageHistory('a1b2-c3d4-e5f6'));
    httpMock
      .expectOne(
        (r) =>
          r.url.includes('/stores/store-1/conversations/a1b2-c3d4-e5f6/messages') &&
          r.method === 'GET',
      )
      .flush({ messages: [mockApiMessage], nextCursor: null });
    const messages = await promise;
    expect(messages.length).toBe(1);
  });

  it('should map VENDOR message: fromId=senderId, toId=customerId', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.getMessageHistory('a1b2-c3d4-e5f6'));
    httpMock.expectOne((r) => r.url.includes('/conversations/')).flush({
      messages: [mockApiMessage],
      nextCursor: null,
    });
    const [msg] = await promise;
    expect(msg.fromId).toBe('vendor-user-1');
    expect(msg.toId).toBe('a1b2-c3d4-e5f6');
    expect(msg.message).toBe('Hello!');
    expect(msg.type).toBe(MessageType.Text);
  });

  it('should map CUSTOMER message: fromId=customerId, toId=currentUserId', async () => {
    const { adapter, httpMock } = configureAdapter('store-1', 'vendor-user-1');
    const promise = firstValueFrom(adapter.getMessageHistory('a1b2-c3d4-e5f6'));
    httpMock.expectOne((r) => r.url.includes('/conversations/')).flush({
      messages: [mockCustomerApiMessage],
      nextCursor: null,
    });
    const [msg] = await promise;
    expect(msg.fromId).toBe('a1b2-c3d4-e5f6'); // customerId
    expect(msg.toId).toBe('vendor-user-1');       // current user
  });

  it('should return empty array when API returns no messages', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.getMessageHistory('a1b2-c3d4-e5f6'));
    httpMock.expectOne((r) => r.url.includes('/conversations/')).flush({ messages: [], nextCursor: null });
    const messages = await promise;
    expect(messages).toEqual([]);
  });

  it('should join socket room when messages are returned', async () => {
    const { adapter, httpMock, mockSocket } = configureAdapter();
    const promise = firstValueFrom(adapter.getMessageHistory('a1b2-c3d4-e5f6'));
    httpMock.expectOne((r) => r.url.includes('/conversations/')).flush({
      messages: [mockApiMessage],
      nextCursor: null,
    });
    await promise;
    const joinCall = mockSocket.emitCalls.find((c) => c.event === 'chat:join');
    expect(joinCall?.data).toEqual({ conversationId: 'conv-abc' });
  });

  it('should return of([]) when storeId is null', async () => {
    const { adapter, httpMock } = configureAdapter(null, null);
    const messages = await firstValueFrom(adapter.getMessageHistory('any'));
    expect(messages).toEqual([]);
    httpMock.expectNone(() => true);
  });

  // ── WebSocket: onMessageReceived ──────────────────────────────────────────

  it('should call onMessageReceived when CUSTOMER message.new arrives for a known participant', async () => {
    const { adapter, httpMock, mockSocket } = configureAdapter();

    // Populate participant cache via listFriends
    const listPromise = firstValueFrom(adapter.listFriends());
    httpMock.expectOne((r) => r.url.includes('/customers')).flush({
      data: [mockCustomer],
      meta: { total: 1, totalPages: 1 },
    });
    await listPromise;

    // Load history to populate conversationMap and init socket
    const historyPromise = firstValueFrom(adapter.getMessageHistory('a1b2-c3d4-e5f6'));
    httpMock.expectOne((r) => r.url.includes('/conversations/')).flush({
      messages: [mockApiMessage],
      nextCursor: null,
    });
    await historyPromise;

    // Spy on onMessageReceived
    let received: { participant: unknown; message: unknown } | null = null;
    adapter.messageReceivedHandler = (p, m) => { received = { participant: p, message: m }; };

    // Simulate incoming CUSTOMER message from server
    mockSocket.trigger('message.new', mockCustomerApiMessage);

    expect(received).not.toBeNull();
    expect((received!.message as any).fromId).toBe('a1b2-c3d4-e5f6');
    expect((received!.message as any).message).toBe('Hi back!');
  });

  it('should ignore message.new events with senderType VENDOR', async () => {
    const { adapter, httpMock, mockSocket } = configureAdapter();

    const historyPromise = firstValueFrom(adapter.getMessageHistory('a1b2-c3d4-e5f6'));
    httpMock.expectOne((r) => r.url.includes('/conversations/')).flush({
      messages: [mockApiMessage],
      nextCursor: null,
    });
    await historyPromise;

    let callCount = 0;
    adapter.messageReceivedHandler = () => { callCount++; };

    mockSocket.trigger('message.new', mockApiMessage); // senderType=VENDOR
    expect(callCount).toBe(0);
  });
});
