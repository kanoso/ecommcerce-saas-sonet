import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-onboarding-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stepper">
      @for (step of steps; track step) {
        <div class="stepper__dot"
          [class.stepper__dot--active]="currentStep() === step"
          [class.stepper__dot--done]="currentStep() > step">
          @if (currentStep() > step) {
            <span class="material-icons-outlined">check</span>
          } @else {
            {{ step }}
          }
        </div>
        @if (step < steps.length) {
          <div class="stepper__line"
            [class.stepper__line--done]="currentStep() > step">
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .stepper {
      display: flex;
      align-items: center;
      gap: 0;
      margin-bottom: 24px;
    }

    .stepper__dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      flex-shrink: 0;
      background: var(--border);
      color: var(--text-secondary);
      transition: all 0.3s ease;
    }

    .stepper__dot .material-icons-outlined {
      font-size: 16px;
    }

    .stepper__dot--active {
      background: var(--primary);
      color: #fff;
    }

    .stepper__dot--done {
      background: var(--primary-light);
      color: var(--primary);
    }

    .stepper__line {
      flex: 1;
      height: 2px;
      background: var(--border);
      transition: all 0.3s ease;
    }

    .stepper__line--done {
      background: var(--primary);
    }
  `],
})
export class OnboardingStepperComponent {
  currentStep = input.required<number>();
  readonly steps = [1, 2, 3, 4];
}
