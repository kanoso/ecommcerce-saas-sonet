import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { StoreRidersStore, RiderSearchResult } from '../store-riders.store';
import { DialogComponent } from '../../../shared/ui/organisms/dialog.component';
import { ButtonComponent } from '../../../shared/ui/atoms/button.component';
import { AvatarComponent } from '../../../shared/ui/atoms/avatar.component';

@Component({
  selector: 'app-invite-rider-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent, AvatarComponent],
  templateUrl: './invite-rider-dialog.component.html',
  styleUrl: './invite-rider-dialog.component.scss',
})
export class InviteRiderDialogComponent implements OnChanges {
  visible = input<boolean>(false);

  closed = output<void>();

  protected readonly store = inject(StoreRidersStore);

  protected selectedRider = signal<RiderSearchResult | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      if (changes['visible'].currentValue === true) {
        // Dialog just opened — trigger initial search
        this.store.searchRiders('');
      } else {
        // Dialog closing — reset local selection
        this.selectedRider.set(null);
      }
    }
  }

  protected onSearch(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.store.searchRiders(q);
  }

  protected selectRider(rider: RiderSearchResult): void {
    this.selectedRider.set(rider);
  }

  protected async onConfirm(): Promise<void> {
    const rider = this.selectedRider();
    if (!rider) return;
    try {
      await this.store.inviteRiderById(rider.id);
      this.onClose(); // store already shows success toast
    } catch {
      // Error toast already shown by store — dialog stays open
    }
  }

  protected onClose(): void {
    this.selectedRider.set(null);
    this.closed.emit();
  }

  protected riderFullName(rider: RiderSearchResult): string {
    return `${rider.user.firstName} ${rider.user.lastName}`.trim();
  }

  protected operationalLabel(status: string | null): string {
    switch (status) {
      case 'ONLINE':   return 'En línea';
      case 'OFFLINE':  return 'Desconectado';
      case 'ON_BREAK': return 'En descanso';
      default:         return '';
    }
  }
}
