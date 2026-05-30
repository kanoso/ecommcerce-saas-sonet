import { inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import {
  ChatAdapter,
  ChatParticipantStatus,
  ChatParticipantType,
  Message,
  MessageType,
  ParticipantResponse,
  ParticipantMetadata,
} from '@tiendi/chat';
import type { IChatParticipant } from '@tiendi/chat';
import { AuthStore } from '../../core/services/auth.store';
import { Customer } from '../customers/customers.store';
import { environment } from '../../../../environments/environment';

interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'VENDOR' | 'CUSTOMER';
  content: string;
  createdAt: string;
}

export const CHAT_SOCKET_FACTORY = new InjectionToken<(url: string) => Socket>(
  'CHAT_SOCKET_FACTORY',
  { factory: () => (url: string) => io(url) },
);

function toParticipant(c: Customer): IChatParticipant {
  return {
    participantType: ChatParticipantType.User,
    id: c.id,
    displayName: c.name,
    status: ChatParticipantStatus.Online,
    avatar: null,
    ordernum: '',
  };
}

function toParticipantResponse(c: Customer): ParticipantResponse {
  const metadata = new ParticipantMetadata();
  metadata.totalUnreadMessages = 0;
  const response = new ParticipantResponse();
  response.participant = toParticipant(c);
  response.metadata = metadata;
  return response;
}

function toLibMessage(msg: ApiMessage, customerId: string, currentUserId: string): Message {
  const m = new Message();
  m.type = MessageType.Text;
  m.fromId = msg.senderType === 'VENDOR' ? msg.senderId : customerId;
  m.toId = msg.senderType === 'VENDOR' ? customerId : currentUserId;
  m.message = msg.content;
  m.dateSent = new Date(msg.createdAt);
  return m;
}

@Injectable({ providedIn: 'root' })
export class VendorChatAdapter extends ChatAdapter implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly socketFactory = inject(CHAT_SOCKET_FACTORY);

  private socket: Socket | null = null;
  private readonly participantsCache = new Map<string, IChatParticipant>();
  private readonly conversationMap = new Map<string, string>(); // conversationId → customerId

  listFriends(): Observable<ParticipantResponse[]> {
    const storeId = this.authStore.currentUser()?.storeId;
    if (!storeId) return of([]);
    return this.http
      .get<{ data: Customer[]; meta: { total: number; totalPages: number } }>(
        `${environment.apiUrl}/stores/${storeId}/customers?limit=100`,
      )
      .pipe(
        map((res) => {
          const responses = res.data.map(toParticipantResponse);
          responses.forEach((r) =>
            this.participantsCache.set(String(r.participant.id), r.participant),
          );
          return responses;
        }),
      );
  }

  sendMessage(message: Message): void {
    const user = this.authStore.currentUser();
    if (!user?.storeId || !message.toId) return;
    this.http
      .post<ApiMessage>(
        `${environment.apiUrl}/stores/${user.storeId}/conversations/${message.toId}/messages`,
        { content: message.message },
      )
      .subscribe({
        next: (msg) => this.joinRoom(msg.conversationId, String(message.toId)),
        error: (err) => console.error('[VendorChat] sendMessage failed', err),
      });
  }

  getMessageHistory(destinataryId: string | number): Observable<Message[]> {
    const user = this.authStore.currentUser();
    if (!user?.storeId) return of([]);
    return this.http
      .get<{ messages: ApiMessage[]; nextCursor: string | null }>(
        `${environment.apiUrl}/stores/${user.storeId}/conversations/${destinataryId}/messages`,
      )
      .pipe(
        tap((res) => {
          if (res.messages.length > 0) {
            this.joinRoom(res.messages[0].conversationId, String(destinataryId));
          }
        }),
        map((res) =>
          res.messages.map((m) => toLibMessage(m, String(destinataryId), user.id)),
        ),
      );
  }

  private joinRoom(conversationId: string, customerId: string): void {
    this.conversationMap.set(conversationId, customerId);
    this.ensureSocket().emit('chat:join', { conversationId });
  }

  private ensureSocket(): Socket {
    if (!this.socket) {
      const baseUrl = environment.apiUrl.replace(/\/api\/v1$/, '');
      this.socket = this.socketFactory(`${baseUrl}/chat`);
      this.socket.on('message.new', (payload: ApiMessage) => {
        if (payload.senderType !== 'CUSTOMER') return;
        const customerId = this.conversationMap.get(payload.conversationId);
        if (!customerId) return;
        const participant = this.participantsCache.get(customerId);
        if (!participant) return;
        const currentUserId = this.authStore.currentUser()?.id ?? '';
        this.onMessageReceived(participant, toLibMessage(payload, customerId, currentUserId));
      });
    }
    return this.socket;
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
