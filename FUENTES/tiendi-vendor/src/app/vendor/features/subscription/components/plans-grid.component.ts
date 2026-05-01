import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BillingCycle, Plan, PlanId } from '../subscription.store';

// Usage:
// <app-plans-grid
//   [plans]="store.plans()"
//   [currentPlanId]="store.subscription()?.planId"
//   [cycle]="store.billingCycle()"
//   (selectPlan)="onSelectPlan($event)" />

const PLAN_ORDER: PlanId[] = ['free', 'pro', 'enterprise'];

@Component({
  selector: 'app-plans-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="plans-section" aria-labelledby="plans-heading">
      <h2 class="plans-section__title" id="plans-heading">Elegí tu plan</h2>

      <div class="plans-grid" role="list">
        @for (plan of sortedPlans(); track plan.id) {
          <div
            class="plan-item"
            [class.plan-item--current]="plan.id === currentPlanId()"
            role="listitem">

            @if (plan.id === currentPlanId()) {
              <div class="plan-item__current-badge" aria-label="Plan actual">
                Plan actual ✓
              </div>
            }

            <div class="plan-item__header">
              <h3 class="plan-item__name">{{ plan.name }}</h3>
              <div class="plan-item__price">
                @if (price(plan) === 0) {
                  <span class="plan-item__amount">Gratis</span>
                } @else {
                  <span class="plan-item__amount">S/ {{ price(plan) }}</span>
                  <span class="plan-item__period">/{{ cycle() === 'annual' ? 'mes*' : 'mes' }}</span>
                }
              </div>
              @if (cycle() === 'annual' && price(plan) > 0) {
                <span class="plan-item__annual-note">*facturado anualmente</span>
              }
            </div>

            <ul class="plan-item__features" aria-label="Características incluidas">
              @for (feature of plan.features; track feature) {
                <li class="plan-item__feature plan-item__feature--included">
                  <span class="plan-item__feature-icon" aria-hidden="true">✓</span>
                  {{ feature }}
                </li>
              }
              @for (missing of plan.missingFeatures; track missing) {
                <li class="plan-item__feature plan-item__feature--excluded" aria-label="{{ missing }} no incluido">
                  <span class="plan-item__feature-icon" aria-hidden="true">✗</span>
                  {{ missing }}
                </li>
              }
            </ul>

            <div class="plan-item__action">
              @switch (buttonType(plan.id)) {
                @case ('current') {
                  <button class="btn btn--disabled" type="button" disabled aria-disabled="true">
                    Plan activo
                  </button>
                }
                @case ('upgrade') {
                  <button
                    class="btn btn--primary"
                    type="button"
                    (click)="selectPlan.emit(plan.id)"
                    [attr.aria-label]="'Actualizar a ' + plan.name">
                    Upgrade →
                  </button>
                }
                @case ('downgrade') {
                  <button
                    class="btn btn--ghost"
                    type="button"
                    (click)="selectPlan.emit(plan.id)"
                    [attr.aria-label]="'Degradar a ' + plan.name">
                    Degradar
                  </button>
                }
              }
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .plans-section {
      margin-bottom: 32px;
    }

    .plans-section__title {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 20px;
    }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    .plan-item {
      position: relative;
      background: var(--card, #fff);
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      transition: box-shadow 0.15s;
    }

    .plan-item:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .plan-item--current {
      border: 2px solid var(--primary, #047857);
      box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.08);
    }

    .plan-item__current-badge {
      position: absolute;
      top: -13px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--primary, #047857);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 3px 14px;
      border-radius: 999px;
      white-space: nowrap;
    }

    .plan-item__header {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .plan-item__name {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }

    .plan-item__price {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .plan-item__amount {
      font-size: 32px;
      font-weight: 800;
      color: #111827;
      line-height: 1;
    }

    .plan-item__period {
      font-size: 14px;
      color: var(--text-muted, #6B7280);
    }

    .plan-item__annual-note {
      font-size: 11px;
      color: var(--text-muted, #6B7280);
    }

    .plan-item__features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }

    .plan-item__feature {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
    }

    .plan-item__feature--included {
      color: #374151;
    }

    .plan-item__feature--excluded {
      color: var(--text-muted, #6B7280);
      text-decoration: line-through;
    }

    .plan-item__feature-icon {
      font-size: 13px;
      flex-shrink: 0;
      line-height: 1.4;
    }

    .plan-item__feature--included .plan-item__feature-icon {
      color: var(--primary, #047857);
      font-weight: 700;
    }

    .plan-item__feature--excluded .plan-item__feature-icon {
      color: var(--text-muted, #6B7280);
    }

    .plan-item__action {
      margin-top: auto;
    }

    .btn {
      width: 100%;
      padding: 10px 18px;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      text-align: center;
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

    .btn--disabled {
      background: var(--surface, #F3F4F6);
      color: var(--text-muted, #6B7280);
      cursor: not-allowed;
      border-color: var(--border, #E5E7EB);
    }
  `],
})
export class PlansGridComponent {
  readonly plans = input.required<Plan[]>();
  readonly currentPlanId = input<PlanId | undefined>(undefined);
  readonly cycle = input.required<BillingCycle>();
  readonly selectPlan = output<PlanId>();

  readonly sortedPlans = computed(() =>
    [...this.plans()].sort(
      (a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id)
    )
  );

  price(plan: Plan): number {
    return this.cycle() === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  }

  buttonType(planId: PlanId): 'current' | 'upgrade' | 'downgrade' {
    const current = this.currentPlanId();
    if (planId === current) return 'current';
    const currentIndex = current ? PLAN_ORDER.indexOf(current) : -1;
    const planIndex = PLAN_ORDER.indexOf(planId);
    return planIndex > currentIndex ? 'upgrade' : 'downgrade';
  }
}
