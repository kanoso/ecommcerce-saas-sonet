export type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
  limit?: number;
}

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeature[];
  maxProducts: number;
  maxStaff: number;
  commissionPercent: number;
  isPopular: boolean;
}

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'EXPIRED';

export interface StoreSubscription {
  id: string;
  storeId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  createdAt: string;
  updatedAt: string;
}
