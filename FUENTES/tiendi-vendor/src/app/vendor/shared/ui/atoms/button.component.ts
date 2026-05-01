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
  template: `
    <button
      [type]="'button'"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() || null"
      [attr.aria-disabled]="disabled() || null"
      [ngClass]="[hostClass(), sizeClass()]"
      (click)="!disabled() && !loading() && clicked.emit()"
    >
      @if (loading()) {
        <span class="btn-spinner" aria-hidden="true"></span>
        <span class="sr-only">Cargando...</span>
      } @else {
        @if (icon() && iconPosition() === 'left') {
          <span class="material-icons-outlined btn-icon" aria-hidden="true">{{ icon() }}</span>
        }
        @if (label()) {
          <span>{{ label() }}</span>
        }
        @if (icon() && iconPosition() === 'right') {
          <span class="material-icons-outlined btn-icon" aria-hidden="true">{{ icon() }}</span>
        }
      }
    </button>
  `,
  styles: [`
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: none;
      border-radius: var(--radius);
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s, box-shadow 0.15s;
      white-space: nowrap;
      position: relative;
      min-width: 44px;
      min-height: 44px;

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    /* Variants */
    .btn-primary {
      background: var(--primary);
      color: #fff;
      &:not(:disabled):hover { background: var(--primary-dark); }
    }
    .btn-secondary {
      background: var(--secondary);
      color: #fff;
      &:not(:disabled):hover { filter: brightness(0.9); }
    }
    .btn-ghost {
      background: transparent;
      color: var(--text-primary);
      border: 1px solid var(--border);
      &:not(:disabled):hover { background: var(--surface); }
    }
    .btn-danger {
      background: var(--danger);
      color: #fff;
      &:not(:disabled):hover { filter: brightness(0.9); }
    }
    .btn-danger-dark {
      background: var(--danger-dark);
      color: #fff;
      &:not(:disabled):hover { filter: brightness(0.85); }
    }

    /* Sizes */
    .btn-sm { font-size: 12px; padding: 6px 12px; min-height: 32px; }
    .btn-md { font-size: 14px; padding: 9px 16px; }
    .btn-lg { font-size: 16px; padding: 12px 24px; }

    /* Icon sizing */
    .btn-icon {
      font-size: 18px;
      line-height: 1;
    }

    /* Spinner */
    .btn-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: btn-spin 0.6s linear infinite;
    }

    @keyframes btn-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .btn-spinner { animation-duration: 1.5s; }
    }
  `],
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
