import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { NgClass } from '@angular/common';

export type TagVariant =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'delivered'
  | 'rejected'
  | 'neutral'
  | 'warning'
  | 'danger'
  | 'info'
  | 'success';

@Component({
  selector: 'td-tag',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <span
      [ngClass]="['tag', 'tag-' + variant()]"
      [attr.aria-label]="label()"
    >
      {{ label() }}
    </span>
  `,
  styles: [`
    .tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    /* Order status tags — uses global .tag-* from styles.scss */

    /* Additional semantic variants */
    .tag-neutral   { background: #F3F4F6; color: #374151; border-color: #D1D5DB; }
    .tag-warning   { background: var(--warning-light); color: #92400E; border-color: #FCD34D; }
    .tag-danger    { background: var(--danger-light); color: #991B1B; border-color: #FCA5A5; }
    .tag-info      { background: var(--info-light); color: #1E40AF; border-color: #93C5FD; }
    .tag-success   { background: var(--primary-light); color: var(--primary-dark); border-color: #6EE7B7; }
  `],
})
export class TagComponent {
  variant = input<TagVariant>('neutral');
  label = input.required<string>();
}
