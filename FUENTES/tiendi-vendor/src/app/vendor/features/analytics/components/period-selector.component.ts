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
  templateUrl: './period-selector.component.html',
  styleUrl: './period-selector.component.scss',
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
