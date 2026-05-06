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
  templateUrl: './billing-cycle-toggle.component.html',
  styleUrl: './billing-cycle-toggle.component.scss',
})
export class BillingCycleToggleComponent {
  readonly cycle = input.required<BillingCycle>();
  readonly cycleChange = output<BillingCycle>();
}
