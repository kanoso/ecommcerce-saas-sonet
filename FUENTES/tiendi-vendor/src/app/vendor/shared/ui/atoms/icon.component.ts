import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<IconSize, string> = {
  sm: '16px',
  md: '20px',
  lg: '24px',
  xl: '32px',
};

@Component({
  selector: 'td-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  name = input.required<string>();
  size = input<IconSize>('md');
  ariaLabel = input<string | null>(null);

  iconSize() {
    return SIZE_MAP[this.size()];
  }
}
