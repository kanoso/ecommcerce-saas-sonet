import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { Order } from '../orders.store';

@Component({
  selector: 'td-order-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-actions.component.html',
  styleUrl: './order-actions.component.scss',
})
export class OrderActionsComponent {
  order = input.required<Order>();
  isUpdating = input<boolean>(false);

  confirm = output<void>();
  dispatch = output<void>();
  deliver = output<void>();
  reject = output<string>();

  readonly confirmModalOpen = signal(false);
  readonly rejectModalOpen = signal(false);
  readonly rejectReason = signal('');

  openConfirmModal(): void {
    this.confirmModalOpen.set(true);
  }

  onConfirmSubmit(): void {
    this.confirmModalOpen.set(false);
    this.confirm.emit();
  }

  onRejectSubmit(): void {
    const reason = this.rejectReason();
    if (reason.length < 10) return;
    this.rejectModalOpen.set(false);
    this.rejectReason.set('');
    this.reject.emit(reason);
  }

  onOverlayClick(event: MouseEvent, modal: 'confirm' | 'reject'): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      if (modal === 'confirm') this.confirmModalOpen.set(false);
      else this.rejectModalOpen.set(false);
    }
  }
}
