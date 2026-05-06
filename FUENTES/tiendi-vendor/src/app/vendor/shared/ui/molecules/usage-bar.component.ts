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
  templateUrl: './usage-bar.component.html',
  styleUrl: './usage-bar.component.scss',
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
