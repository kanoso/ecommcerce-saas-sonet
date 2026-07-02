import { effect, inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
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
import { environment } from '../../../../environments/environment';

interface ConversationSummary {
  customerId: string;
  customerName: string;
  lastMessageAt: string;
  lastMessageContent: string | null;
}

interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'VENDOR' | 'CUSTOMER';
  content: string;
  createdAt: string;
  // Present on socket 'message.new' payloads: the id the conversation is keyed
  // by. Use this (not senderId) to key the participant and fetch history.
  customerId?: string;
}

export const CHAT_SOCKET_FACTORY = new InjectionToken<(url: string) => Socket>(
  'CHAT_SOCKET_FACTORY',
  { factory: () => (url: string) => io(url) },
);

function toLibMessage(msg: ApiMessage, customerId: string, currentUserId: string): Message {
  const m = new Message();
  m.type = MessageType.Text;
  m.fromId = msg.senderType === 'VENDOR' ? msg.senderId : customerId;
  m.toId = msg.senderType === 'VENDOR' ? customerId : currentUserId;
  m.message = msg.content;
  m.dateSent = new Date(msg.createdAt);
  return m;
}

@Injectable()
export class VendorChatAdapter extends ChatAdapter implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly socketFactory = inject(CHAT_SOCKET_FACTORY);

  private socket: Socket | null = null;
  // id → ParticipantResponse. Seeded by listFriends (customers who ordered) and
  // extended live when a chat-only customer (no orders) sends a message.
  private readonly participants = new Map<string, ParticipantResponse>();
  private readonly conversationMap = new Map<string, string>(); // conversationId → customerId

  private buildParticipantResponse(id: string, displayName: string, subtitle = ''): ParticipantResponse {
    const participant: IChatParticipant = {
      participantType: ChatParticipantType.User,
      id,
      displayName,
      status: ChatParticipantStatus.Online,
      avatar: null,
      subtitle,
    };
    const metadata = new ParticipantMetadata();
    metadata.totalUnreadMessages = 0;
    const response = new ParticipantResponse();
    response.participant = participant;
    response.metadata = metadata;
    return response;
  }

  /** Resolve the real display name for a chat-only customer and refresh the list. */
  private fetchCustomerName(customerId: string): void {
    const storeId = this.authStore.currentUser()?.storeId;
    if (!storeId) return;
    this.http
      .get<{ id: string; name: string }>(
        `${environment.apiUrl}/stores/${storeId}/customers/${customerId}`,
      )
      .subscribe({
        next: (c) => {
          const response = this.participants.get(customerId);
          if (response && c.name) {
            response.participant.displayName = c.name;
            this.onFriendsListChanged([...this.participants.values()]);
          }
        },
        error: () => {
          /* keep the 'Cliente' fallback */
        },
      });
  }

  constructor() {
    super();
    // Connect socket as soon as storeId is available (even if chat panel is closed).
    // The 'connect' handler in ensureSocket() will emit chat:joinStore on connect/reconnect.
    effect(() => {
      const storeId = this.authStore.currentUser()?.storeId;
      if (storeId) this.ensureSocket();
    });
  }

  listFriends(): Observable<ParticipantResponse[]> {
    const storeId = this.authStore.currentUser()?.storeId;
    if (!storeId) return of([]);
    // The message panel lists conversations (anyone who has chatted), not just
    // customers who placed orders. Chat-only customers must appear here too.
    return this.http
      .get<{ data: ConversationSummary[] }>(
        `${environment.apiUrl}/stores/${storeId}/conversations`,
      )
      .pipe(
        map((res) => {
          res.data.forEach((c) => {
            const subtitle = c.lastMessageContent ?? '';
            const existing = this.participants.get(c.customerId);
            if (existing) {
              existing.participant.displayName = c.customerName;
              existing.participant.subtitle = subtitle;
            } else {
              this.participants.set(
                c.customerId,
                this.buildParticipantResponse(c.customerId, c.customerName, subtitle),
              );
            }
          });
          return [...this.participants.values()];
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

      const joinStore = () => {
        const storeId = this.authStore.currentUser()?.storeId;
        if (storeId) this.socket!.emit('chat:joinStore', { storeId });
      };
      this.socket.on('connect', joinStore);
      if (this.socket.connected) joinStore();

      this.socket.on('message.new', (payload: ApiMessage) => {
        if (payload.senderType !== 'CUSTOMER') return;

        const customerId =
          payload.customerId ??
          this.conversationMap.get(payload.conversationId) ??
          payload.senderId;
        this.conversationMap.set(payload.conversationId, customerId);

        // Ensure the sender is in the participants list. A chat-only customer
        // (no orders) is absent from listFriends, so add them and push the
        // updated list so a conversation row appears in the vendor UI.
        let response = this.participants.get(customerId);
        if (!response) {
          response = this.buildParticipantResponse(customerId, 'Cliente');
          this.participants.set(customerId, response);
          this.onFriendsListChanged([...this.participants.values()]);
          this.fetchCustomerName(customerId);
        }

        const currentUserId = this.authStore.currentUser()?.id ?? '';
        this.onMessageReceived(
          response.participant,
          toLibMessage(payload, customerId, currentUserId),
        );
      });
    }
    return this.socket;
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
