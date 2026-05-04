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
  templateUrl: './current-plan-card.component.html',
  styleUrl: './current-plan-card.component.scss',
})
export class CurrentPlanCardComponent {
  readonly subscription = input<Subscription | null>(null);
  readonly plan = input<Plan | null>(null);
  readonly cancelPlan = output<void>();
  readonly changePlan = output<void>();

  readonly formatDate = formatDate;
}
