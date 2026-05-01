import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ButtonComponent } from '../atoms/button.component';

@Component({
  selector: 'td-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <div class="error-state" role="alert">
      <span class="material-icons-outlined error-state__icon" aria-hidden="true">error_outline</span>
      <p class="error-state__message">{{ message() }}</p>
      <td-button
        label="Reintentar"
        variant="ghost"
        icon="refresh"
        (clicked)="retry.emit()"
      />
    </div>
  `,
  styles: [`
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 24px;
      text-align: center;
    }

    .error-state__icon {
      font-size: 48px;
      color: var(--danger);
      opacity: 0.6;
    }

    .error-state__message {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0;
      max-width: 320px;
    }
  `],
})
export class ErrorStateComponent {
  message = input<string>('Ocurrió un error inesperado.');
  retry = output<void>();
}
