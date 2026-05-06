import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ButtonComponent } from '../atoms/button.component';
import { IconComponent } from '../atoms/icon.component';

@Component({
  selector: 'td-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  title = input.required<string>();
  message = input.required<string>();
  icon = input<string>('inbox');
  actionLabel = input<string | null>(null);

  action = output<void>();
}
