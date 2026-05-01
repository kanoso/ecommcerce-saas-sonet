import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Plan, Subscription } from '../subscription.store';
import { UsageBarComponent } from './usage-bar.component';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

// Usage:
// <app-current-plan-card
//   [subscription]="store.subscription()"
//   [plan]="store.currentPlan()"
//   (cancelPlan)="onCancel()"
//   (changePlan)="scrollToPlans()" />

@Component({
  selector: 'app-current-plan-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UsageBarComponent],
  template: `
    @if (subscription(); as sub) {
      <div class="plan-card" aria-label="Plan actual">
        <div class="plan-card__header">
          <div class="plan-card__info">
            <span class="plan-badge" [class]="'plan-badge--' + sub.planId">
              {{ plan()?.name ?? sub.planId }}
            </span>
            <div class="plan-card__price">
              @if (plan()?.monthlyPrice === 0) {
                <span class="plan-card__amount">Gratis</span>
              } @else {
                <span class="plan-card__amount">S/ {{ plan()?.monthlyPrice ?? 0 }}</span>
                <span class="plan-card__period">/mes</span>
              }
            </div>
          </div>
          <div class="plan-card__renewal">
            <span class="plan-card__renewal-label">Próxima renovación</span>
            <span class="plan-card__renewal-date">{{ formatDate(sub.currentPeriodEnd) }}</span>
          </div>
        </div>

        <div class="plan-card__usage">
          <h3 class="plan-card__usage-title">Uso del plan</h3>
          <div class="plan-card__bars">
            <app-usage-bar
              label="Productos"
              [used]="sub.usageProducts"
              [max]="plan()?.maxProducts ?? null" />
            <app-usage-bar
              label="Pedidos este mes"
              [used]="sub.usageOrders"
              [max]="plan()?.maxOrders ?? null" />
            <app-usage-bar
              label="Staff"
              [used]="sub.usageStaff"
              [max]="plan()?.maxStaff ?? null" />
          </div>
        </div>

        <div class="plan-card__actions">
          <button
            class="btn btn--ghost btn--danger"
            type="button"
            [disabled]="sub.status === 'cancelled'"
            (click)="cancelPlan.emit()"
            aria-label="Cancelar plan actual">
            {{ sub.status === 'cancelled' ? 'Plan cancelado' : 'Cancelar plan' }}
          </button>
          <button
            class="btn btn--primary"
            type="button"
            (click)="changePlan.emit()"
            aria-label="Cambiar de plan">
            Cambiar plan
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .plan-card {
      background: var(--card, #fff);
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .plan-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
    }

    .plan-card__info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .plan-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      width: fit-content;
    }

    .plan-badge--free {
      background: #F3F4F6;
      color: #374151;
    }

    .plan-badge--pro {
      background: #D1FAE5;
      color: #065F46;
    }

    .plan-badge--enterprise {
      background: #EDE9FE;
      color: #4C1D95;
    }

    .plan-card__price {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .plan-card__amount {
      font-size: 28px;
      font-weight: 800;
      color: #111827;
      line-height: 1;
    }

    .plan-card__period {
      font-size: 14px;
      color: var(--text-muted, #6B7280);
    }

    .plan-card__renewal {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }

    .plan-card__renewal-label {
      font-size: 12px;
      color: var(--text-muted, #6B7280);
    }

    .plan-card__renewal-date {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
    }

    .plan-card__usage-title {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 12px;
    }

    .plan-card__bars {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .plan-card__actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 9px 18px;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .btn--primary {
      background: var(--primary, #047857);
      color: #fff;
    }

    .btn--primary:hover {
      background: var(--primary-dark, #065F46);
    }

    .btn--ghost {
      background: transparent;
      border-color: var(--border, #E5E7EB);
      color: #374151;
    }

    .btn--ghost:hover {
      background: var(--surface, #F3F4F6);
    }

    .btn--danger {
      color: var(--danger, #EF4444);
      border-color: #FECACA;
    }

    .btn--danger:hover {
      background: #FEF2F2;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
})
export class CurrentPlanCardComponent {
  readonly subscription = input<Subscription | null>(null);
  readonly plan = input<Plan | null>(null);
  readonly cancelPlan = output<void>();
  readonly changePlan = output<void>();

  readonly formatDate = formatDate;
}
