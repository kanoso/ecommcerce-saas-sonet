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
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
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
