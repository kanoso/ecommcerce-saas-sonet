import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'td-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="progress-bar"
      role="progressbar"
      [attr.aria-valuenow]="clampedValue()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="'Progreso: ' + clampedValue() + '%'"
    >
      <div
        class="progress-bar__fill"
        [style.width.%]="clampedValue()"
      ></div>
    </div>
  `,
  styles: [`
    .progress-bar {
      height: 6px;
      background: var(--border);
      border-radius: 999px;
      overflow: hidden;
      width: 100%;
    }

    .progress-bar__fill {
      height: 100%;
      background: var(--primary);
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    @media (prefers-reduced-motion: reduce) {
      .progress-bar__fill { transition: none; }
    }
  `],
})
export class ProgressBarComponent {
  value = input.required<number>();

  clampedValue = computed(() => Math.min(100, Math.max(0, this.value())));
}
