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
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
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
