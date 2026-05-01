import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { UiStore, Toast } from '../../core/services/ui.store';

const TOAST_ICONS: Record<Toast['type'], string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

@Component({
  selector: 'td-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="toast-container" aria-label="Notificaciones" aria-live="polite">
      @for (toast of uiStore.toasts(); track toast.id) {
        <div
          class="toast"
          [ngClass]="'toast--' + toast.type"
          [attr.role]="toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'"
          [attr.aria-live]="toast.type === 'error' ? 'assertive' : 'polite'"
          aria-atomic="true"
        >
          <span
            class="material-icons-outlined toast__icon"
            aria-hidden="true"
          >{{ toastIcon(toast) }}</span>

          <span class="toast__message">{{ toast.message }}</span>

          <button
            type="button"
            class="toast__close"
            aria-label="Cerrar notificación"
            (click)="uiStore.removeToast(toast.id)"
          >
            <span class="material-icons-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 380px;
      width: calc(100vw - 48px);

      @media (max-width: 767px) {
        bottom: 80px; /* Above bottom nav */
        right: 16px;
        left: 16px;
        width: auto;
        max-width: none;
      }
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--radius-lg);
      background: var(--card);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-md);
      animation: toast-in 0.2s ease;

      &:focus { outline: none; }
    }

    .toast__icon {
      font-size: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast__message {
      flex: 1;
      font-size: 14px;
      color: var(--text-primary);
      line-height: 1.4;
    }

    .toast__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      border-radius: 50%;
      cursor: pointer;
      color: var(--text-secondary);
      padding: 0;
      flex-shrink: 0;
      margin-top: -2px;

      &:hover { background: var(--surface); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }

      span { font-size: 16px; }
    }

    /* Variants */
    .toast--success {
      border-color: var(--primary-accent);
      .toast__icon { color: var(--primary-accent); }
    }

    .toast--error {
      border-color: var(--danger);
      .toast__icon { color: var(--danger); }
    }

    .toast--warning {
      border-color: var(--warning);
      .toast__icon { color: var(--warning); }
    }

    .toast--info {
      border-color: var(--info);
      .toast__icon { color: var(--info); }
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateX(16px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast { animation: none; }
    }
  `],
})
export class ToastComponent {
  readonly uiStore = inject(UiStore);

  toastIcon(toast: Toast): string {
    return TOAST_ICONS[toast.type];
  }
}
