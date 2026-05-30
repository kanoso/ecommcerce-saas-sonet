import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, EMPTY } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ChatAdapter,
  ChatParticipantStatus,
  ChatParticipantType,
  Message,
  ParticipantResponse,
  ParticipantMetadata,
} from '@tiendi/chat';
import type { IChatParticipant } from '@tiendi/chat';
import { AuthStore } from '../../core/services/auth.store';
import { Customer } from '../customers/customers.store';
import { environment } from '../../../../environments/environment';

function toParticipant(c: Customer): IChatParticipant {
  return {
    participantType: ChatParticipantType.User,
    id: c.id, // string UUID — never coerce to number
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

@Injectable({ providedIn: 'root' })
export class VendorChatAdapter extends ChatAdapter {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);

  listFriends(): Observable<ParticipantResponse[]> {
    const storeId = this.authStore.currentUser()?.storeId;
    if (!storeId) return of([]);
    return this.http
      .get<{ data: Customer[]; meta: { total: number; totalPages: number } }>(
        `${environment.apiUrl}/stores/${storeId}/customers?limit=100`,
      )
      .pipe(map((res) => res.data.map(toParticipantResponse)));
  }

  sendMessage(_message: Message): void {
    // no-op — real transport deferred to a future PR
  }

  getMessageHistory(_destinataryId: string | number): Observable<Message[]> {
    return EMPTY;
  }
}
