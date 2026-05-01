import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Usage: <app-usage-bar label="Productos" [used]="47" [max]="200" />
// When max is null → unlimited → shows "ilimitado"

@Component({
  selector: 'app-usage-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="usage-bar">
      <div class="usage-bar__header">
        <span class="usage-bar__label">{{ label() }}</span>
        <span class="usage-bar__value">
          @if (max() === null) {
            {{ used() }} / ilimitado
          } @else {
            {{ used() }} / {{ max() }}
          }
        </span>
      </div>
      <div class="usage-bar__track" role="progressbar"
           [attr.aria-valuenow]="used()"
           [attr.aria-valuemin]="0"
           [attr.aria-valuemax]="max() ?? used()"
           [attr.aria-label]="label() + ': ' + used() + ' de ' + (max() ?? 'ilimitado')">
        <div class="usage-bar__fill"
             [style.width.%]="fillPercent()"
             [class.usage-bar__fill--danger]="isAtLimit()">
        </div>
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
      color: var(--text-muted, #6B7280);
      font-weight: 500;
    }

    .usage-bar__value {
      font-size: 12px;
      color: var(--text-muted, #6B7280);
    }

    .usage-bar__track {
      height: 8px;
      background: var(--surface, #F3F4F6);
      border-radius: 999px;
      overflow: hidden;
    }

    .usage-bar__fill {
      height: 100%;
      background: var(--primary, #047857);
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    .usage-bar__fill--danger {
      background: var(--danger, #EF4444);
    }
  `],
})
export class UsageBarComponent {
  readonly label = input.required<string>();
  readonly used = input.required<number>();
  readonly max = input<number | null>(null);

  readonly fillPercent = computed(() => {
    const m = this.max();
    if (m === null || m === 0) return 0;
    return Math.min(100, Math.round((this.used() / m) * 100));
  });

  readonly isAtLimit = computed(() => {
    const m = this.max();
    return m !== null && this.used() >= m;
  });
}
