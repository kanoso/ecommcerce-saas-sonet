import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-onboarding-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding-stepper.component.html',
  styleUrl: './onboarding-stepper.component.scss',
})
export class OnboardingStepperComponent {
  currentStep = input.required<number>();
  readonly steps = [1, 2, 3, 4];
}
