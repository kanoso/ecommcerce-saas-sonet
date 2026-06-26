import { inject, Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';

export interface VendorRiderEvent {
  deliveryId: string;
  riderId: string;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class VendorRealtimeService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly authStore = inject(AuthStore);

  readonly riderAccepted$ = new Subject<VendorRiderEvent>();
  readonly riderRejected$ = new Subject<VendorRiderEvent>();

  connect(storeId: string): void {
    if (this.socket?.connected) return;

    const baseUrl = environment.apiUrl.replace(/\/api\/v1$/, '');
    this.socket = io(`${baseUrl}/tracking`, {
      auth: { userId: this.authStore.currentUser()?.id },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join-vendor-room', { storeId });
    });

    this.socket.on('vendor:rider-accepted', (data: VendorRiderEvent) => {
      this.riderAccepted$.next(data);
    });

    this.socket.on('vendor:rider-rejected', (data: VendorRiderEvent) => {
      this.riderRejected$.next(data);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
