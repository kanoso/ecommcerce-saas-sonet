import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgClass } from '@angular/common';

export type AvatarSize = 'sm' | 'md' | 'lg';

const AVATAR_COLORS = [
  '#047857', '#4338CA', '#B45309', '#B91C1C',
  '#1D4ED8', '#7C3AED', '#BE185D', '#0F766E',
];

@Component({
  selector: 'td-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  imageUrl = input<string | null>(null);
  name = input.required<string>();
  size = input<AvatarSize>('md');
  ariaLabel = input<string | null>(null);

  initials = computed(() => {
    const parts = this.name().trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return this.name().slice(0, 2).toUpperCase();
  });

  initialsColor = computed(() => {
    let hash = 0;
    for (let i = 0; i < this.name().length; i++) {
      hash = this.name().charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  });
}
