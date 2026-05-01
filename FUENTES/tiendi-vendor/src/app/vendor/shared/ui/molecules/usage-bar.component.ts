import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'td-usage-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="usage-bar">
      <div class="usage-bar__header">
        <span class="usage-bar__label">{{ label() }}</span>
        <span class="usage-bar__value" aria-live="polite">
          {{ current() }}
          @if (max() !== null) {
            <span class="usage-bar__max"> / {{ max() }}</span>
          } @else {
            <span class="usage-bar__unlimited"> / ilimitado</span>
          }
        </span>
      </div>

      <div
        class="usage-bar__track"
        role="progressbar"
        [attr.aria-valuenow]="percentage()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-label]="label() + ': ' + percentage() + '%'"
      >
        <div
          class="usage-bar__fill"
          [ngClass]="fillClass()"
          [style.width.%]="percentage()"
        ></div>
      </div>
    </div>
  `,
  styles: [`
    .usage-bar {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .usage-bar__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .usage-bar__label {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .usage-bar__value {
      font-size: 13px;
      color: var(--text-primary);
      font-weight: 600;
    }

    .usage-bar__max,
    .usage-bar__unlimited {
      font-weight: 400;
      color: var(--text-secondary);
    }

    .usage-bar__track {
      height: 8px;
      background: var(--border);
      border-radius: 999px;
      overflow: hidden;
    }

    .usage-bar__fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease, background 0.3s;
    }

    .fill-green  { background: var(--primary-accent); }
    .fill-yellow { background: var(--warning); }
    .fill-red    { background: var(--danger); }
  `],
})
export class UsageBarComponent {
  current = input.required<number>();
  max = input<number | null>(null);
  label = input.required<string>();

  percentage = computed(() => {
    const m = this.max();
    if (m === null) return 100;
    if (m === 0) return 100;
    return Math.min(100, Math.round((this.current() / m) * 100));
  });

  fillClass = computed(() => {
    const p = this.percentage();
    const m = this.max();
    if (m === null) return 'fill-green';
    if (p >= 100) return 'fill-red';
    if (p >= 80) return 'fill-yellow';
    return 'fill-green';
  });
}
