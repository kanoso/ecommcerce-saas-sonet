import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnChanges,
  output,
  SimpleChanges,
  viewChild,
} from '@angular/core';
import { ButtonComponent } from '../atoms/button.component';

export type ConfirmDialogVariant = 'default' | 'destructive';

@Component({
  selector: 'td-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    @if (visible()) {
      <div class="dialog-backdrop" (click)="onBackdropClick()" aria-hidden="true"></div>

      <div
        #dialogEl
        class="dialog"
        [class.dialog--destructive]="variant() === 'destructive'"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="dialogTitleId"
        [attr.aria-describedby]="dialogDescId"
        (keydown.escape)="onCancel()"
      >
        <h2 [id]="dialogTitleId" class="dialog__title">{{ title() }}</h2>
        <p [id]="dialogDescId" class="dialog__message">{{ message() }}</p>

        <div class="dialog__actions">
          <td-button
            #cancelBtn
            [label]="cancelLabel()"
            variant="ghost"
            (clicked)="onCancel()"
          />
          <td-button
            [label]="confirmLabel()"
            [variant]="variant() === 'destructive' ? 'danger' : 'primary'"
            (clicked)="onConfirm()"
          />
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      animation: backdrop-in 0.15s ease;
    }

    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
      background: var(--card);
      border-radius: var(--radius-lg);
      padding: 24px;
      width: min(480px, calc(100vw - 32px));
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      animation: dialog-in 0.15s ease;

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
      }
    }

    .dialog__title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 8px;
    }

    .dialog--destructive .dialog__title {
      color: var(--danger-dark);
    }

    .dialog__message {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0 0 24px;
      line-height: 1.6;
    }

    .dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    @keyframes backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes dialog-in {
      from { opacity: 0; transform: translate(-50%, -52%) scale(0.97); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .dialog, .dialog-backdrop { animation: none; }
    }
  `],
})
export class ConfirmDialogComponent implements AfterViewInit, OnChanges {
  title = input.required<string>();
  message = input.required<string>();
  confirmLabel = input<string>('Confirmar');
  cancelLabel = input<string>('Cancelar');
  variant = input<ConfirmDialogVariant>('default');
  visible = input<boolean>(false);

  confirmed = output<void>();
  cancelled = output<void>();

  dialogEl = viewChild<ElementRef<HTMLDivElement>>('dialogEl');

  readonly dialogTitleId = `dialog-title-${Math.random().toString(36).slice(2, 7)}`;
  readonly dialogDescId = `dialog-desc-${Math.random().toString(36).slice(2, 7)}`;

  private previousFocus: HTMLElement | null = null;

  ngAfterViewInit(): void {
    if (this.visible()) {
      this.trapFocus();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      if (changes['visible'].currentValue) {
        this.previousFocus = document.activeElement as HTMLElement;
        setTimeout(() => this.trapFocus(), 0);
      } else {
        this.previousFocus?.focus();
      }
    }
  }

  private trapFocus(): void {
    const el = this.dialogEl()?.nativeElement;
    if (!el) return;
    // Focus cancel button first per spec
    const cancelBtn = el.querySelector('button') as HTMLButtonElement | null;
    cancelBtn?.focus();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onConfirm(): void {
    this.confirmed.emit();
  }

  onBackdropClick(): void {
    this.cancelled.emit();
  }
}
