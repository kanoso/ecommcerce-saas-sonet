import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { PaymentMethod } from '../subscription.store';

// Usage: <app-payment-method-card [method]="store.paymentMethod()" />

@Component({
  selector: 'app-payment-method-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-method-card.component.html',
  styleUrl: './payment-method-card.component.scss',
})
export class PaymentMethodCardComponent {
  readonly method = input<PaymentMethod | null>(null);
  readonly toast = signal<string | null>(null);

  padMonth(month: number): string {
    return String(month).padStart(2, '0');
  }

  onChangePM(): void {
    this.toast.set('Redirigiendo a pasarela de pago... (mock)');
    setTimeout(() => this.toast.set(null), 3000);
  }
}
