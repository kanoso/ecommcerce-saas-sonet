import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { SubscriptionStore, PlanId } from '../subscription.store';
import { TrialBannerComponent } from '../components/trial-banner.component';
import { CurrentPlanCardComponent } from '../components/current-plan-card.component';
import { BillingCycleToggleComponent } from '../components/billing-cycle-toggle.component';
import { PlansGridComponent } from '../components/plans-grid.component';
import { PaymentHistoryTableComponent } from '../components/payment-history-table.component';
import { PaymentMethodCardComponent } from '../components/payment-method-card.component';

@Component({
  selector: 'app-subscription-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TrialBannerComponent,
    CurrentPlanCardComponent,
    BillingCycleToggleComponent,
    PlansGridComponent,
    PaymentHistoryTableComponent,
    PaymentMethodCardComponent,
  ],
  templateUrl: './subscription.page.html',
  styleUrl: './subscription.page.scss',
})
export class SubscriptionPage implements OnInit {
  protected readonly store = inject(SubscriptionStore);

  /** Inline signal for cancel confirmation modal visibility */
  protected readonly cancelOpen = signal(false);

  @ViewChild('plansRef') private plansRef!: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.store.loadAll();
  }

  scrollToPlans(): void {
    this.plansRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onCancel(): void {
    this.cancelOpen.set(true);
  }

  confirmCancel(): void {
    this.store.cancelSubscription();
    this.cancelOpen.set(false);
  }

  onSelectPlan(planId: PlanId): void {
    this.store.changePlan(planId);
    // Scroll back to top to see success message
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
