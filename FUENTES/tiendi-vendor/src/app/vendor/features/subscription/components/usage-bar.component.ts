import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Usage: <app-usage-bar label="Productos" [used]="47" [max]="200" />
// When max is null → unlimited → shows "ilimitado"

@Component({
  selector: 'app-usage-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usage-bar.component.html',
  styleUrl: './usage-bar.component.scss',
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
