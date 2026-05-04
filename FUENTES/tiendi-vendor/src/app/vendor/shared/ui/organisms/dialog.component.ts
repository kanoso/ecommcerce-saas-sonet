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
import { NgClass } from '@angular/common';

export type DialogSize = 'sm' | 'md' | 'lg' | 'full';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'td-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
})
export class DialogComponent implements AfterViewInit, OnChanges {
  title = input.required<string>();
  size = input<DialogSize>('md');
  visible = input<boolean>(false);

  closed = output<void>();

  dialogPanel = viewChild<ElementRef<HTMLDivElement>>('dialogPanel');
  private previousFocus: HTMLElement | null = null;

  readonly titleId = `dialog-title-${Math.random().toString(36).slice(2, 7)}`;

  ngAfterViewInit(): void {
    if (this.visible()) this.focusFirst();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      if (changes['visible'].currentValue) {
        this.previousFocus = document.activeElement as HTMLElement;
        setTimeout(() => this.focusFirst(), 0);
      } else {
        this.previousFocus?.focus();
      }
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closed.emit();
      return;
    }
    if (event.key === 'Tab') {
      this.trapTab(event);
    }
  }

  private trapTab(event: KeyboardEvent): void {
    const panel = this.dialogPanel()?.nativeElement;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusFirst(): void {
    const panel = this.dialogPanel()?.nativeElement;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }

  onBackdropClick(): void {
    this.closed.emit();
  }
}
