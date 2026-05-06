import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-dark';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type IconPosition = 'left' | 'right';

@Component({
  selector: 'td-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  label = input<string>('');
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  loading = input<boolean>(false);
  disabled = input<boolean>(false);
  icon = input<string>('');
  iconPosition = input<IconPosition>('left');

  clicked = output<void>();

  hostClass(): string {
    return `btn-${this.variant()}`;
  }

  sizeClass(): string {
    return `btn-${this.size()}`;
  }
}
