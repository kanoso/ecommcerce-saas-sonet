import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'td-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="stepper" role="list" aria-label="Progreso">
      @for (step of stepsArray(); track step.index) {
        <div class="stepper__step" role="listitem">
          <div
            class="stepper__dot"
            [ngClass]="{
              'stepper__dot--active': step.index === current(),
              'stepper__dot--completed': step.index < current()
            }"
            [attr.aria-label]="stepAriaLabel(step.index)"
          >
            @if (step.index < current()) {
              <span class="material-icons-outlined" aria-hidden="true" style="font-size:12px">check</span>
            }
          </div>

          @if (step.index < steps() - 1) {
            <div
              class="stepper__line"
              [class.stepper__line--completed]="step.index < current()"
            ></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .stepper {
      display: flex;
      align-items: center;
    }

    .stepper__step {
      display: flex;
      align-items: center;
      flex: 1;

      &:last-child { flex: none; }
    }

    .stepper__dot {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid var(--border);
      background: var(--card);
      flex-shrink: 0;
      transition: all 0.2s;
      color: var(--card);
      font-size: 12px;
    }

    .stepper__dot--active {
      border-color: var(--primary);
      background: var(--primary);
      box-shadow: 0 0 0 4px rgba(4,120,87,0.15);
    }

    .stepper__dot--completed {
      border-color: var(--primary-accent);
      background: var(--primary-accent);
    }

    .stepper__line {
      flex: 1;
      height: 2px;
      background: var(--border);
      margin: 0 4px;
      transition: background 0.3s;
    }

    .stepper__line--completed {
      background: var(--primary-accent);
    }
  `],
})
export class StepperComponent {
  steps = input.required<number>();
  current = input.required<number>();

  stepsArray = computed(() =>
    Array.from({ length: this.steps() }, (_, i) => ({ index: i })),
  );

  stepAriaLabel(index: number): string {
    const curr = this.current();
    if (index < curr) return `Paso ${index + 1}: completado`;
    if (index === curr) return `Paso ${index + 1}: actual`;
    return `Paso ${index + 1}: pendiente`;
  }
}
