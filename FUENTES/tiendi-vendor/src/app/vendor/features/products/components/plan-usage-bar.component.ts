import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'td-plan-usage-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="usage" [class.usage--warning]="isWarning()">
      <span class="material-icons-outlined usage__icon" aria-hidden="true">inventory</span>

      <div class="usage__content">
        <div class="usage__header">
          <span class="usage__label">Uso del plan</span>
          <span class="usage__count" aria-live="polite">
            {{ used() }} / {{ max() }} productos
          </span>
        </div>
        <div
          class="usage__track"
          role="progressbar"
          [attr.aria-valuenow]="percentage()"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-label]="'Uso del plan: ' + percentage() + '%'"
        >
          <div
            class="usage__fill"
            [class.usage__fill--warning]="isWarning()"
            [style.width.%]="percentage()"
          ></div>
        </div>
        @if (isWarning()) {
          <p class="usage__alert">Estás cerca del límite del plan. Considerá ampliarlo.</p>
        }
      </div>

      <a class="usage__link" routerLink="/vendor/subscription" aria-label="Ampliar plan de productos">
        Ampliar plan →
      </a>
    </div>
  `,
  styles: [`
    .usage {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
    }

    .usage--warning {
      background: #FFFBEB;
      border-color: #FDE68A;
    }

    .usage__icon {
      font-size: 22px;
      color: var(--primary);
      flex-shrink: 0;
    }

    .usage__content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .usage__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .usage__label {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .usage__count {
      font-size: 13px;
      color: var(--text-primary);
      font-weight: 600;
    }

    .usage__track {
      background: var(--border);
      border-radius: 4px;
      height: 6px;
      overflow: hidden;
    }

    .usage__fill {
      height: 100%;
      background: var(--primary);
      border-radius: 4px;
      transition: width 0.4s ease;
    }

    .usage__fill--warning {
      background: var(--warning);
    }

    .usage__alert {
      margin: 0;
      font-size: 12px;
      color: #92400E;
    }

    .usage__link {
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
      white-space: nowrap;
      font-weight: 500;
      flex-shrink: 0;

      &:hover { text-decoration: underline; }
      &:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 2px; }
    }
  `],
})
export class PlanUsageBarComponent {
  used = input.required<number>();
  max = input.required<number>();

  percentage = computed(() => Math.min(100, Math.round((this.used() / this.max()) * 100)));
  isWarning = computed(() => this.percentage() > 80);
}
