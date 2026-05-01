import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';

export type SkeletonVariant = 'line' | 'circle' | 'rect' | 'card';

@Component({
  selector: 'td-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NgStyle],
  template: `
    <span
      [ngClass]="['skeleton', 'skeleton-' + variant()]"
      [ngStyle]="customStyle()"
      role="presentation"
      aria-hidden="true"
    ></span>
  `,
  styles: [`
    .skeleton {
      display: block;
      background: linear-gradient(
        90deg,
        #E5E7EB 25%,
        #F3F4F6 50%,
        #E5E7EB 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
      border-radius: var(--radius);
    }

    .skeleton-line   { height: 16px; width: 100%; border-radius: 4px; }
    .skeleton-circle { border-radius: 50%; }
    .skeleton-rect   { border-radius: var(--radius); }
    .skeleton-card   {
      height: 120px;
      width: 100%;
      border-radius: var(--radius-lg);
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
        background: #E5E7EB;
      }
    }
  `],
})
export class SkeletonComponent {
  variant = input<SkeletonVariant>('line');
  width = input<string>('');
  height = input<string>('');

  customStyle() {
    const styles: Record<string, string> = {};
    if (this.width()) styles['width'] = this.width();
    if (this.height()) styles['height'] = this.height();
    return styles;
  }
}
