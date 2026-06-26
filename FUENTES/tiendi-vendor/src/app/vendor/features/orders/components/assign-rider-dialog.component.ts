import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VendorDeliveryStore, RiderCandidate } from '../vendor-delivery.store';
import { DialogComponent } from '../../../shared/ui/organisms/dialog.component';
import { ButtonComponent } from '../../../shared/ui/atoms/button.component';
import { AvatarComponent } from '../../../shared/ui/atoms/avatar.component';
import { SpinnerComponent } from '../../../shared/ui/atoms/spinner.component';

type Tab = 'trusted' | 'nearby';

@Component({
  selector: 'td-assign-rider-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent, AvatarComponent, SpinnerComponent, FormsModule],
  templateUrl: './assign-rider-dialog.component.html',
  styleUrl: './assign-rider-dialog.component.scss',
})
export class AssignRiderDialogComponent implements OnChanges {
  orderId = input.required<string>();
  visible = input.required<boolean>();

  closed = output<void>();
  assigned = output<void>();

  protected readonly store = inject(VendorDeliveryStore);
  protected selectedRider = signal<RiderCandidate | null>(null);
  protected activeTab = signal<Tab>('trusted');
  protected nameFilter = signal('');

  protected filteredTrusted = computed(() => {
    const q = this.nameFilter().toLowerCase().trim();
    return q
      ? this.store.trusted().filter(r => r.displayName.toLowerCase().includes(q))
      : this.store.trusted();
  });

  protected filteredNearby = computed(() => {
    const q = this.nameFilter().toLowerCase().trim();
    return q
      ? this.store.nearby().filter(r => r.displayName.toLowerCase().includes(q))
      : this.store.nearby();
  });

  constructor() {
    effect(() => {
      if (this.store.assigned()) {
        this.assigned.emit();
        this.onClose();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      if (changes['visible'].currentValue === true) {
        this.activeTab.set('trusted');
        this.nameFilter.set('');
        this.store.loadTrusted(this.orderId());
      } else {
        this.store.reset();
        this.selectedRider.set(null);
        this.nameFilter.set('');
      }
    }
  }

  protected switchTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.nameFilter.set('');
    if (tab === 'nearby') {
      this.store.loadNearby(this.orderId());
    }
  }

  protected selectRider(rider: RiderCandidate): void {
    this.selectedRider.set(rider);
  }

  protected back(): void {
    this.selectedRider.set(null);
  }

  protected async confirm(): Promise<void> {
    const rider = this.selectedRider();
    if (!rider) return;
    await this.store.assignRider(this.orderId(), rider.riderId);
  }

  protected onClose(): void {
    this.selectedRider.set(null);
    this.nameFilter.set('');
    this.store.reset();
    this.closed.emit();
  }

  protected formatEta(eta: number | 'unavailable'): string {
    if (eta === 'unavailable') return 'ETA no disponible';
    return `${Math.ceil(eta / 60)} min`;
  }
}
