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
  templateUrl: './tag.component.html',
  styleUrl: './tag.component.scss',
})
export class TagComponent {
  variant = input<TagVariant>('neutral');
  label = input.required<string>();
}
