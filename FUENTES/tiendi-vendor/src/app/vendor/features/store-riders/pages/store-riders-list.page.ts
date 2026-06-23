import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { StoreRidersStore, StoreRider, TrustStatus } from '../store-riders.store';
import { AuthStore } from '../../../core/services/auth.store';
import { RiderCardComponent } from '../components/rider-card.component';
import { InviteRiderDialogComponent } from '../components/invite-rider-dialog.component';
import { EmptyStateComponent } from '../../../shared/ui/molecules/empty-state.component';
import { DialogComponent } from '../../../shared/ui/organisms/dialog.component';
import { ButtonComponent } from '../../../shared/ui/atoms/button.component';

@Component({
  selector: 'app-store-riders-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RiderCardComponent,
    InviteRiderDialogComponent,
    EmptyStateComponent,
    DialogComponent,
    ButtonComponent,
  ],
  templateUrl: './store-riders-list.page.html',
  styleUrl: './store-riders-list.page.scss',
})
export class StoreRidersListPage implements OnInit {
  protected readonly store      = inject(StoreRidersStore);
  private  readonly authStore   = inject(AuthStore);

  protected readonly hasStoreId = computed(() => !!this.authStore.currentUser()?.storeId);

  inviteOpen    = signal(false);
  confirmRemove = signal<StoreRider | null>(null);

  ngOnInit(): void {
    this.store.loadRiders();
  }

  openInvite(): void  { this.inviteOpen.set(true); }
  closeInvite(): void { this.inviteOpen.set(false); }

  onStatusChange(event: { rider: StoreRider; status: TrustStatus }): void {
    this.store.updateStatus(event.rider.id, event.status as 'ACTIVE' | 'SUSPENDED');
  }

  onRemove(rider: StoreRider): void {
    this.confirmRemove.set(rider);
  }

  confirmRemoveYes(): void {
    const rider = this.confirmRemove();
    if (rider) {
      this.store.removeRider(rider.id);
      this.confirmRemove.set(null);
    }
  }

  cancelRemove(): void {
    this.confirmRemove.set(null);
  }
}
