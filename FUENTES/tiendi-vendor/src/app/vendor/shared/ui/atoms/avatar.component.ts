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
  template: `
    <span
      [ngClass]="['avatar', 'avatar-' + size()]"
      [attr.aria-hidden]="!ariaLabel() || null"
      [attr.aria-label]="ariaLabel() || null"
      role="img"
    >
      @if (imageUrl()) {
        <img
          [src]="imageUrl()"
          [alt]="name()"
          class="avatar-img"
          loading="lazy"
        />
      } @else {
        <span
          class="avatar-initials"
          [style.background]="initialsColor()"
          aria-hidden="true"
        >
          {{ initials() }}
        </span>
      }
    </span>
  `,
  styles: [`
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--border);
    }

    .avatar-sm { width: 32px; height: 32px; font-size: 11px; }
    .avatar-md { width: 40px; height: 40px; font-size: 14px; }
    .avatar-lg { width: 56px; height: 56px; font-size: 18px; }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: #fff;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `],
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
