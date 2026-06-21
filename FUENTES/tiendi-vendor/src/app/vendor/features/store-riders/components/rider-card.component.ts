import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AvatarComponent } from '../../../shared/ui/atoms/avatar.component';
import { TagComponent, TagVariant } from '../../../shared/ui/atoms/tag.component';
import { ButtonComponent } from '../../../shared/ui/atoms/button.component';
import { StoreRider, TrustStatus } from '../store-riders.store';

@Component({
  selector: 'app-rider-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, TagComponent, ButtonComponent],
  templateUrl: './rider-card.component.html',
  styleUrl: './rider-card.component.scss',
})
export class RiderCardComponent {
  rider = input.required<StoreRider>();

  statusChange = output<{ rider: StoreRider; status: TrustStatus }>();
  remove       = output<StoreRider>();

  tagVariant = computed((): TagVariant => {
    switch (this.rider().trustStatus) {
      case 'ACTIVE':    return 'success';
      case 'PENDING':   return 'pending';
      case 'SUSPENDED': return 'warning';
      default:          return 'neutral';
    }
  });

  tagLabel = computed((): string => {
    switch (this.rider().trustStatus) {
      case 'ACTIVE':    return 'Activo';
      case 'PENDING':   return 'Pendiente';
      case 'SUSPENDED': return 'Suspendido';
      default:          return '';
    }
  });

  operationalLabel = computed((): string => {
    switch (this.rider().operationalStatus) {
      case 'ONLINE':   return 'En línea';
      case 'OFFLINE':  return 'Desconectado';
      case 'ON_BREAK': return 'En descanso';
      default:         return '';
    }
  });

  onSuspend(): void {
    this.statusChange.emit({ rider: this.rider(), status: 'SUSPENDED' });
  }

  onActivate(): void {
    this.statusChange.emit({ rider: this.rider(), status: 'ACTIVE' });
  }

  onRemove(): void {
    this.remove.emit(this.rider());
  }
}
