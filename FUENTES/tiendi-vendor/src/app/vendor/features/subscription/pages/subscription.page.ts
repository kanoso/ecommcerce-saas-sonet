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
  template: `
    <div class="sub-page">
      <header class="sub-page__header">
        <h1 class="sub-page__title">Suscripción y Plan</h1>
        <p class="sub-page__subtitle">Administrá tu plan, facturación y método de pago.</p>
      </header>

      <!-- Loading state -->
      @if (store.isLoading()) {
        <div class="sub-page__loading" role="status" aria-label="Cargando suscripción">
          <div class="spinner" aria-hidden="true"></div>
          <span>Cargando información de tu plan...</span>
        </div>
      }

      <!-- Error state -->
      @if (store.error()) {
        <div class="sub-page__error" role="alert">
          <span>{{ store.error() }}</span>
          <button type="button" (click)="store.loadAll()">Reintentar</button>
        </div>
      }

      <!-- Success toast -->
      @if (store.successMessage()) {
        <div class="toast toast--success" role="status" aria-live="polite">
          {{ store.successMessage() }}
        </div>
      }

      <!-- Trial banner -->
      @if (store.isInTrial()) {
        <app-trial-banner
          [daysLeft]="store.trialDaysLeft()"
          (upgrade)="scrollToPlans()" />
      }

      <!-- Current plan card -->
      <app-current-plan-card
        [subscription]="store.subscription()"
        [plan]="store.currentPlan()"
        (cancelPlan)="onCancel()"
        (changePlan)="scrollToPlans()" />

      <!-- Billing toggle -->
      <app-billing-cycle-toggle
        [cycle]="store.billingCycle()"
        (cycleChange)="store.setBillingCycle($event)" />

      <!-- Plans grid -->
      <div #plansRef>
        <app-plans-grid
          [plans]="store.plans()"
          [currentPlanId]="store.subscription()?.planId"
          [cycle]="store.billingCycle()"
          (selectPlan)="onSelectPlan($event)" />
      </div>

      <!-- Payment history -->
      <app-payment-history-table [records]="store.paymentHistory()" />

      <!-- Payment method -->
      <app-payment-method-card [method]="store.paymentMethod()" />

      <!-- Cancel confirmation modal -->
      @if (cancelOpen()) {
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
          <div class="modal">
            <h2 class="modal__title" id="cancel-modal-title">Cancelar suscripción</h2>
            <p class="modal__body">
              ¿Estás seguro que querés cancelar tu suscripción?
              Seguirás teniendo acceso hasta el <strong>{{ store.subscription()?.currentPeriodEnd }}</strong>.
            </p>
            <div class="modal__actions">
              <button
                class="btn btn--ghost"
                type="button"
                (click)="cancelOpen.set(false)">
                Volver
              </button>
              <button
                class="btn btn--danger"
                type="button"
                [disabled]="store.isSaving()"
                (click)="confirmCancel()">
                {{ store.isSaving() ? 'Cancelando...' : 'Sí, cancelar' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sub-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 16px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .sub-page__header {
      margin-bottom: 4px;
    }

    .sub-page__title {
      font-size: 24px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 4px;
    }

    .sub-page__subtitle {
      font-size: 14px;
      color: var(--text-muted, #6B7280);
      margin: 0;
    }

    .sub-page__loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
      color: var(--text-muted, #6B7280);
      font-size: 14px;
      justify-content: center;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border, #E5E7EB);
      border-top-color: var(--primary, #047857);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .sub-page__error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: var(--radius, 8px);
      color: #991B1B;
      font-size: 14px;
      flex-wrap: wrap;
    }

    .sub-page__error button {
      padding: 6px 14px;
      border: 1px solid #FECACA;
      border-radius: var(--radius, 8px);
      background: transparent;
      color: #991B1B;
      font-size: 13px;
      cursor: pointer;
    }

    .sub-page__error button:hover {
      background: #FEE2E2;
    }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: fadeUp 0.2s ease;
    }

    .toast--success {
      background: #065F46;
      color: #fff;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Cancel modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 900;
      padding: 16px;
    }

    .modal {
      background: var(--card, #fff);
      border-radius: var(--radius-lg, 12px);
      padding: 28px 24px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    }

    .modal__title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 12px;
    }

    .modal__body {
      font-size: 14px;
      color: #374151;
      line-height: 1.6;
      margin: 0 0 24px;
    }

    .modal__actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .btn {
      padding: 9px 18px;
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s;
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
      background: var(--danger, #EF4444);
      color: #fff;
    }

    .btn--danger:hover {
      background: #DC2626;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
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
