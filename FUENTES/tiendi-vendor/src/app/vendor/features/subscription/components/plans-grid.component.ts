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
  templateUrl: './plans-grid.component.html',
  styleUrl: './plans-grid.component.scss',
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
