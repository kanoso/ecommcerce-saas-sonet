import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { PaymentMethod } from '../subscription.store';

// Usage: <app-payment-method-card [method]="store.paymentMethod()" />

@Component({
  selector: 'app-payment-method-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pm-card" aria-labelledby="pm-heading">
      <h2 class="pm-card__title" id="pm-heading">Método de pago</h2>

      @if (method(); as pm) {
        <div class="pm-card__content">
          <div class="pm-card__details">
            <div class="pm-card__brand" [class]="'pm-card__brand--' + pm.brand.toLowerCase()">
              {{ pm.brand }}
            </div>
            <div class="pm-card__number" aria-label="Número de tarjeta terminado en {{ pm.last4 }}">
              <span class="pm-card__dots" aria-hidden="true">•••• •••• ••••</span>
              <span class="pm-card__last4">{{ pm.last4 }}</span>
            </div>
            <div class="pm-card__expiry" [attr.aria-label]="'Vence ' + padMonth(pm.expMonth) + '/' + pm.expYear">
              Vence {{ padMonth(pm.expMonth) }}/{{ pm.expYear }}
            </div>
          </div>
          <button
            class="btn-change"
            type="button"
            (click)="onChangePM()"
            aria-label="Cambiar método de pago">
            Cambiar
          </button>
        </div>
      } @else {
        <div class="pm-card__empty">
          <p>No hay método de pago registrado.</p>
          <button class="btn-add" type="button" (click)="onChangePM()" aria-label="Agregar método de pago">
            Agregar método de pago
          </button>
        </div>
      }

      @if (toast()) {
        <div class="toast" role="status" aria-live="polite">{{ toast() }}</div>
      }
    </section>
  `,
  styles: [`
    .pm-card {
      background: var(--card, #fff);
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      padding: 24px;
    }

    .pm-card__title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 16px;
    }

    .pm-card__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .pm-card__details {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .pm-card__brand {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
      background: #1F2937;
      color: #fff;
      min-width: 52px;
      text-align: center;
    }

    .pm-card__brand--mastercard {
      background: #EB001B;
    }

    .pm-card__number {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 15px;
    }

    .pm-card__dots {
      color: var(--text-muted, #6B7280);
      letter-spacing: 2px;
    }

    .pm-card__last4 {
      font-weight: 700;
      color: #111827;
      font-size: 15px;
    }

    .pm-card__expiry {
      font-size: 13px;
      color: var(--text-muted, #6B7280);
    }

    .btn-change {
      padding: 8px 18px;
      background: transparent;
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
    }

    .btn-change:hover {
      background: var(--surface, #F3F4F6);
    }

    .pm-card__empty {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pm-card__empty p {
      color: var(--text-muted, #6B7280);
      font-size: 14px;
      margin: 0;
    }

    .btn-add {
      padding: 8px 18px;
      background: var(--primary, #047857);
      color: #fff;
      border: none;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-add:hover {
      background: var(--primary-dark, #065F46);
    }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1F2937;
      color: #fff;
      padding: 12px 20px;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
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
