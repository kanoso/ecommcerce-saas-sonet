import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

// Usage: <app-trial-banner [daysLeft]="store.trialDaysLeft()" (upgrade)="scrollToPlans()" />

@Component({
  selector: 'app-trial-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trial-banner.component.html',
  styleUrl: './trial-banner.component.scss',
})
export class TrialBannerComponent {
  readonly daysLeft = input.required<number>();
  readonly upgrade = output<void>();
}
