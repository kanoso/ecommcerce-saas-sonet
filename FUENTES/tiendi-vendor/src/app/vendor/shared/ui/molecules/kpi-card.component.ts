import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SkeletonComponent } from '../atoms/skeleton.component';
import { IconComponent } from '../atoms/icon.component';

@Component({
  selector: 'td-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, SkeletonComponent, IconComponent],
  template: `
    <article
      class="kpi-card"
      [class.kpi-card--clickable]="true"
      (click)="clicked.emit()"
      (keydown.enter)="clicked.emit()"
      tabindex="0"
      [attr.aria-label]="title() + ': ' + value()"
      role="button"
    >
      @if (loading()) {
        <div class="kpi-skeleton">
          <td-skeleton variant="line" width="60%" height="14px" />
          <td-skeleton variant="line" width="40%" height="32px" />
          <td-skeleton variant="line" width="80%" height="12px" />
        </div>
      } @else {
        <div class="kpi-header">
          <span class="kpi-title">{{ title() }}</span>
          @if (icon()) {
            <span class="kpi-icon-wrap" aria-hidden="true">
              <td-icon [name]="icon()" size="lg" />
            </span>
          }
        </div>

        <div class="kpi-value" aria-live="polite">{{ value() }}</div>

        @if (change() !== null) {
          <div
            class="kpi-change"
            [ngClass]="changeClass()"
            [attr.aria-label]="changeAriaLabel()"
          >
            <span class="material-icons-outlined kpi-arrow" aria-hidden="true">
              {{ change()! > 0 ? 'arrow_upward' : 'arrow_downward' }}
            </span>
            <span>{{ changeAbs() }}%</span>
            @if (changeLabel()) {
              <span class="kpi-change-label">{{ changeLabel() }}</span>
            }
          </div>
        }
      }
    </article>
  `,
  styles: [`
    .kpi-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: var(--shadow);
      transition: box-shadow 0.15s, transform 0.15s;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
      }

      &:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-1px);
      }
    }

    .kpi-skeleton {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .kpi-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-title {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kpi-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: var(--primary-light);
      border-radius: var(--radius);
      color: var(--primary);
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .kpi-change {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .kpi-change-up {
      color: var(--primary-dark);
    }

    .kpi-change-down {
      color: #B91C1C;
    }

    .kpi-arrow {
      font-size: 14px;
    }

    .kpi-change-label {
      color: var(--text-secondary);
      font-weight: 400;
      margin-left: 2px;
    }
  `],
})
export class KpiCardComponent {
  title = input.required<string>();
  value = input.required<string | number>();
  change = input<number | null>(null);
  changeLabel = input<string>('');
  icon = input<string>('');
  loading = input<boolean>(false);

  clicked = output<void>();

  changeAbs = computed(() => Math.abs(this.change() ?? 0).toFixed(1));

  changeClass = computed(() => ({
    'kpi-change-up': (this.change() ?? 0) > 0,
    'kpi-change-down': (this.change() ?? 0) < 0,
  }));

  changeAriaLabel = computed(() => {
    const val = this.change();
    if (val === null) return '';
    const dir = val > 0 ? 'subió' : 'bajó';
    return `${dir} ${Math.abs(val).toFixed(1)}% ${this.changeLabel()}`;
  });
}
