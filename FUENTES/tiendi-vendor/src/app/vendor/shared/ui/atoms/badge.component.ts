import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgClass } from '@angular/common';

export type BadgeVariant = 'danger' | 'warning' | 'info';

@Component({
  selector: 'td-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    @if (count() > 0) {
      <span
        [ngClass]="['badge', 'badge-' + variant()]"
        [attr.aria-label]="ariaLabel()"
        role="status"
      >
        {{ displayCount() }}
      </span>
    }
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      color: #fff;
    }
    .badge-danger  { background: var(--danger); }
    .badge-warning { background: var(--warning); color: #111827; }
    .badge-info    { background: var(--info); }
  `],
})
export class BadgeComponent {
  count = input.required<number>();
  max = input<number>(99);
  variant = input<BadgeVariant>('danger');

  displayCount = computed(() =>
    this.count() > this.max() ? `${this.max()}+` : String(this.count()),
  );

  ariaLabel = computed(() =>
    this.count() > this.max()
      ? `Más de ${this.max()} notificaciones`
      : `${this.count()} notificaciones`,
  );
}
