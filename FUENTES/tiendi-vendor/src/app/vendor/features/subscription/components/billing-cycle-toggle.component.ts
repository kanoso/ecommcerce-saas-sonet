import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BillingCycle } from '../subscription.store';

// Usage:
// <app-billing-cycle-toggle
//   [cycle]="store.billingCycle()"
//   (cycleChange)="store.setBillingCycle($event)" />

@Component({
  selector: 'app-billing-cycle-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cycle-toggle" role="group" aria-label="Ciclo de facturación">
      <button
        class="cycle-toggle__btn"
        [class.cycle-toggle__btn--active]="cycle() === 'monthly'"
        type="button"
        (click)="cycleChange.emit('monthly')"
        [attr.aria-pressed]="cycle() === 'monthly'">
        Mensual
      </button>
      <button
        class="cycle-toggle__btn"
        [class.cycle-toggle__btn--active]="cycle() === 'annual'"
        type="button"
        (click)="cycleChange.emit('annual')"
        [attr.aria-pressed]="cycle() === 'annual'">
        Anual
        <span class="cycle-toggle__badge" aria-label="Ahorrá 20%">Ahorrá 20%</span>
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      margin: 8px 0 24px;
    }

    .cycle-toggle {
      display: inline-flex;
      background: var(--surface, #F3F4F6);
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      padding: 4px;
      gap: 4px;
    }

    .cycle-toggle__btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      border: none;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-muted, #6B7280);
      background: transparent;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    }

    .cycle-toggle__btn--active {
      background: var(--card, #fff);
      color: #111827;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .cycle-toggle__badge {
      display: inline-block;
      padding: 2px 8px;
      background: #D1FAE5;
      color: var(--primary, #047857);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }
  `],
})
export class BillingCycleToggleComponent {
  readonly cycle = input.required<BillingCycle>();
  readonly cycleChange = output<BillingCycle>();
}
