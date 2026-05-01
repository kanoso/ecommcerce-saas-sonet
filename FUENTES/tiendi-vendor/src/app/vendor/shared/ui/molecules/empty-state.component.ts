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
  template: `
    <div class="empty-state" role="status">
      <td-icon [name]="icon()" size="xl" ariaLabel="" />
      <h3 class="empty-state__title">{{ title() }}</h3>
      <p class="empty-state__message">{{ message() }}</p>
      @if (actionLabel()) {
        <td-button
          [label]="actionLabel()!"
          variant="primary"
          (clicked)="action.emit()"
        />
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px 24px;
      text-align: center;
      color: var(--text-secondary);

      td-icon {
        opacity: 0.35;
        color: var(--text-muted);
      }
    }

    .empty-state__title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .empty-state__message {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0;
      max-width: 320px;
    }
  `],
})
export class EmptyStateComponent {
  title = input.required<string>();
  message = input.required<string>();
  icon = input<string>('inbox');
  actionLabel = input<string | null>(null);

  action = output<void>();
}
