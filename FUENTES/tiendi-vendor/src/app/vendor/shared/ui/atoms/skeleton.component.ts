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
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss',
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
