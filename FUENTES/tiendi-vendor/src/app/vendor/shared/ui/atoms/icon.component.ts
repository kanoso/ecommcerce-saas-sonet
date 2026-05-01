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
  template: `
    <span
      class="material-icons-outlined"
      [style.font-size]="iconSize()"
      [attr.aria-hidden]="!ariaLabel() ? 'true' : null"
      [attr.aria-label]="ariaLabel() || null"
      [attr.role]="ariaLabel() ? 'img' : null"
    >{{ name() }}</span>
  `,
  styles: [`
    span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      vertical-align: middle;
      user-select: none;
    }
  `],
})
export class IconComponent {
  name = input.required<string>();
  size = input<IconSize>('md');
  ariaLabel = input<string | null>(null);

  iconSize() {
    return SIZE_MAP[this.size()];
  }
}
