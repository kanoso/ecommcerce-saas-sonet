import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-onboarding-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding-nav.component.html',
  styleUrl: './onboarding-nav.component.scss',
})
export class OnboardingNavComponent {
  step = input.required<number>();
  isLastStep = input<boolean>(false);
  isSaving = input<boolean>(false);

  prev = output<void>();
  next = output<void>();
  skip = output<void>();
}
