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
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
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
