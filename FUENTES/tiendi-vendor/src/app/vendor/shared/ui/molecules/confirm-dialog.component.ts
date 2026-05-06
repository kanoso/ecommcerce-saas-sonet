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
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
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
