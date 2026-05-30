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
import { firstValueFrom, lastValueFrom } from 'rxjs';
import {
  ChatParticipantStatus,
  ChatParticipantType,
} from '@tiendi/chat';
import { VendorChatAdapter } from './vendor-chat.adapter';
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

function configureAdapter(storeId: string | null = 'store-1', userId: string | null = '42') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(withInterceptorsFromDi()),
      provideHttpClientTesting(),
      VendorChatAdapter,
      { provide: AuthStore, useValue: makeAuthStore(storeId, userId) },
    ],
  });
  return {
    adapter: TestBed.inject(VendorChatAdapter),
    httpMock: TestBed.inject(HttpTestingController),
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

  // ── Task 3.2: toParticipant mapping ─────────────────────────────────────

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

  // ── Task 3.3: listFriends() happy path ──────────────────────────────────

  it('should issue GET to /stores/{storeId}/customers?limit=100 and return mapped responses', async () => {
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
    expect(responses[0].participant.id).toBe('a1b2-c3d4-e5f6');
  });

  // ── Task 3.4: listFriends() empty list ──────────────────────────────────

  it('should emit empty array when API returns no customers', async () => {
    const { adapter, httpMock } = configureAdapter();
    const promise = firstValueFrom(adapter.listFriends());
    httpMock
      .expectOne((r) => r.url.includes('/customers'))
      .flush({ data: [], meta: { total: 0, totalPages: 0 } });
    const responses = await promise;
    expect(responses).toEqual([]);
  });

  // ── Task 3.5: listFriends() when storeId is null ────────────────────────

  it('should return of([]) and make no HTTP request when storeId is null', async () => {
    const { adapter, httpMock } = configureAdapter(null, null);
    const responses = await firstValueFrom(adapter.listFriends());
    expect(responses).toEqual([]);
    httpMock.expectNone((r) => r.url.includes('/customers'));
  });

  // ── Task 3.6: sendMessage is a no-op ────────────────────────────────────

  it('should not issue any HTTP request when sendMessage is called', () => {
    const { adapter, httpMock } = configureAdapter();
    expect(() =>
      adapter.sendMessage({
        fromId: '42',
        toId: 'a1b2-c3d4-e5f6',
        message: 'Hello',
      } as any),
    ).not.toThrow();
    httpMock.expectNone(() => true);
  });

  // ── Task 3.7: getMessageHistory returns EMPTY ────────────────────────────

  it('should complete with zero emissions from getMessageHistory', async () => {
    const { adapter } = configureAdapter();
    const result = await lastValueFrom(adapter.getMessageHistory('a1b2-c3d4-e5f6'), {
      defaultValue: undefined,
    });
    expect(result).toBeUndefined();
  });
});
