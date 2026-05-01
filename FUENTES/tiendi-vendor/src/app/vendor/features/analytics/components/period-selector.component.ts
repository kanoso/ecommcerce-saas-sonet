import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { Period } from '../analytics.store';

@Component({
  selector: 'app-period-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="period-selector">
      <div class="period-btns">
        @for (btn of buttons; track btn.value) {
          <button
            class="btn-period"
            [class.btn--active]="period() === btn.value"
            (click)="select(btn.value)"
          >
            {{ btn.label }}
          </button>
        }
        <button
          class="btn-period"
          [class.btn--active]="period() === 'custom'"
          (click)="toggleCustom()"
        >
          Rango personalizado
        </button>
      </div>

      @if (showCustom()) {
        <div class="custom-range">
          <label class="range-label">
            Desde
            <input
              type="date"
              class="date-input"
              [value]="customRange()?.from ?? ''"
              (change)="onFromChange($event)"
            />
          </label>
          <label class="range-label">
            Hasta
            <input
              type="date"
              class="date-input"
              [value]="customRange()?.to ?? ''"
              (change)="onToChange($event)"
            />
          </label>
          <button class="btn-apply" (click)="applyCustom()">Aplicar</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .period-selector {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .period-btns {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .btn-period {
      padding: 6px 16px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-period:hover {
      border-color: var(--primary);
      color: var(--primary);
    }
    .btn--active {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
      font-weight: 600;
    }
    .custom-range {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .range-label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .date-input {
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 14px;
      background: var(--card);
      color: #111;
      outline: none;
    }
    .date-input:focus {
      border-color: var(--primary);
    }
    .btn-apply {
      padding: 8px 20px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: var(--radius);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-apply:hover {
      background: var(--primary-dark);
    }
  `],
})
export class PeriodSelectorComponent {
  period = input.required<Period>();
  customRange = input<{ from: string; to: string } | null>(null);

  periodChange = output<Period>();
  customRangeChange = output<{ from: string; to: string }>();

  showCustom = signal(false);

  private fromValue = '';
  private toValue = '';

  readonly buttons: { label: string; value: Period }[] = [
    { label: 'Hoy', value: 'today' },
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' },
    { label: 'Año', value: 'year' },
  ];

  select(period: Period): void {
    this.showCustom.set(false);
    this.periodChange.emit(period);
  }

  toggleCustom(): void {
    this.showCustom.update((v) => !v);
  }

  onFromChange(event: Event): void {
    this.fromValue = (event.target as HTMLInputElement).value;
  }

  onToChange(event: Event): void {
    this.toValue = (event.target as HTMLInputElement).value;
  }

  applyCustom(): void {
    if (this.fromValue && this.toValue) {
      this.customRangeChange.emit({ from: this.fromValue, to: this.toValue });
      this.showCustom.set(false);
    }
  }
}
