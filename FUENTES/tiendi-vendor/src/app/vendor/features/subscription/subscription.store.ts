import { inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { forkJoin, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';
import { AnalyticsService } from '../../core/services/analytics.service';

const API = environment.apiUrl;

// ─── Domain Types ───────────────────────────────────────────────────────────

export type PlanId = string;
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'trial' | 'cancelled' | 'expired';

export interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  maxProducts: number | null;
  maxOrders: number | null;
  maxStaff: number | null;
  features: string[];
  missingFeatures: string[];
}

export interface Subscription {
  id: string;
  storeId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  usageProducts: number;
  usageOrders: number;
  usageStaff: number;
  plan?: Plan;
}

export interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

// ─── Store State ─────────────────────────────────────────────────────────────

interface SubscriptionState {
  subscription: Subscription | null;
  plans: Plan[];
  paymentHistory: PaymentRecord[];
  paymentMethod: PaymentMethod | null;
  billingCycle: BillingCycle;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
}

/**
 * Retorna mensajes de bloqueo si la tienda excede los límites del plan objetivo.
 * Se usa antes de permitir un downgrade.
 */
function getDowngradeBlockers(
  state: { subscription: () => Subscription | null; plans: () => Plan[] },
  targetPlanId: string,
): string[] {
  const targetPlan = state.plans().find((p) => p.id === targetPlanId);
  const usage = state.subscription();
  if (!targetPlan || !usage) return [];

  const blockers: string[] = [];

  if (targetPlan.maxProducts !== null && usage.usageProducts > targetPlan.maxProducts) {
    blockers.push(
      `Productos: ${usage.usageProducts} en uso (límite: ${targetPlan.maxProducts})`,
    );
  }
  if (targetPlan.maxOrders !== null && usage.usageOrders > targetPlan.maxOrders) {
    blockers.push(
      `Pedidos activos: ${usage.usageOrders} (límite: ${targetPlan.maxOrders})`,
    );
  }
  if (targetPlan.maxStaff !== null && usage.usageStaff > targetPlan.maxStaff) {
    blockers.push(
      `Empleados: ${usage.usageStaff} (límite: ${targetPlan.maxStaff})`,
    );
  }

  if (blockers.length > 0) {
    blockers.unshift('No se puede degradar — excede los límites del plan:');
  }

  return blockers;
}

export const SubscriptionStore = signalStore(
  { providedIn: 'root' },
  withState<SubscriptionState>({
    subscription: null,
    plans: [],
    paymentHistory: [],
    paymentMethod: null,
    billingCycle: 'monthly',
    isLoading: false,
    isSaving: false,
    error: null,
    successMessage: null,
  }),

  withComputed((store) => ({
    currentPlan: computed(() =>
      store.plans().find((p) => p.id === store.subscription()?.planId) ?? store.subscription()?.plan ?? null
    ),
    trialDaysLeft: computed(() => {
      const sub = store.subscription();
      if (!sub?.trialEndsAt) return 0;
      return Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000));
    }),
    isInTrial: computed(() => store.subscription()?.status === 'trial'),
  })),

  withMethods((store) => {
    const http = inject(HttpClient);
    const authStore = inject(AuthStore);
    const analytics = inject(AnalyticsService);

    function storeId(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    function showSuccess(msg: string): void {
      patchState(store, { successMessage: msg });
      setTimeout(() => patchState(store, { successMessage: null }), 3500);
    }

    return {
      loadAll(): void {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isLoading: true, error: null });

        forkJoin({
          subscription:   http.get<Subscription>(`${API}/stores/${sid}/subscription`),
          plans:          http.get<Plan[]>(`${API}/subscription-plans`),
          paymentHistory: http.get<{ data: PaymentRecord[] }>(`${API}/stores/${sid}/payment-history`),
          paymentMethod:  http.get<PaymentMethod | null>(`${API}/stores/${sid}/payment-method`),
        }).subscribe({
          next: ({ subscription, plans, paymentHistory, paymentMethod }) => {
            patchState(store, {
              subscription,
              plans,
              paymentHistory: paymentHistory.data ?? [],
              paymentMethod,
              billingCycle: subscription?.billingCycle ?? 'monthly',
              isLoading: false,
            });
          },
          error: (err: unknown) => {
            patchState(store, {
              isLoading: false,
              error: err instanceof Error ? err.message : 'Error al cargar suscripción',
            });
          },
        });
      },

      setBillingCycle(cycle: BillingCycle): void {
        patchState(store, { billingCycle: cycle });
      },

      async changePlan(planId: string): Promise<void> {
        const sid = storeId();
        if (!sid) return;

        const blockers = getDowngradeBlockers(store, planId);
        if (blockers.length > 0) {
          patchState(store, { error: blockers.join(' | ') });
          return;
        }

        patchState(store, { isSaving: true });
        try {
          const updated = await firstValueFrom(
            http.post<Subscription>(`${API}/stores/${sid}/subscription/change`, {
              planId,
              billingCycle: store.billingCycle(),
            })
          );
          patchState(store, { subscription: updated, isSaving: false });
          analytics.capture('plan_changed', { planId });
          showSuccess('Plan actualizado correctamente');
        } catch (err: unknown) {
          patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al cambiar plan' });
        }
      },

      async cancelSubscription(): Promise<void> {
        const sid = storeId();
        if (!sid) return;
        const sub = store.subscription();
        if (!sub) return;
        patchState(store, { isSaving: true });
        try {
          await firstValueFrom(http.post(`${API}/stores/${sid}/subscription/cancel`, {}));
          patchState(store, { subscription: { ...sub, status: 'cancelled' }, isSaving: false });
          showSuccess('Suscripción cancelada');
        } catch (err: unknown) {
          patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al cancelar suscripción' });
        }
      },
    };
  })
);
