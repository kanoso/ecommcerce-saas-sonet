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
  template: `
    @if (visible()) {
      <div
        class="dialog-backdrop"
        (click)="onBackdropClick()"
        aria-hidden="true"
      ></div>

      <div
        #dialogPanel
        class="dialog-panel"
        [ngClass]="'dialog-panel--' + size()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (keydown)="onKeydown($event)"
      >
        <div class="dialog-panel__header">
          <h2 [id]="titleId" class="dialog-panel__title">{{ title() }}</h2>
          <button
            type="button"
            class="dialog-panel__close"
            aria-label="Cerrar diálogo"
            (click)="closed.emit()"
          >
            <span class="material-icons-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="dialog-panel__body">
          <ng-content />
        </div>

        <div class="dialog-panel__footer">
          <ng-content select="[slot=footer]" />
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      animation: fade-in 0.15s ease;
    }

    .dialog-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
      background: var(--card);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 32px);
      box-shadow: 0 25px 50px rgba(0,0,0,0.25);
      animation: dialog-in 0.15s ease;
      overflow: hidden;

      &:focus { outline: none; }
    }

    .dialog-panel--sm   { width: min(400px, calc(100vw - 32px)); }
    .dialog-panel--md   { width: min(560px, calc(100vw - 32px)); }
    .dialog-panel--lg   { width: min(800px, calc(100vw - 32px)); }
    .dialog-panel--full { width: calc(100vw - 32px); height: calc(100vh - 32px); }

    .dialog-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .dialog-panel__title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .dialog-panel__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      border-radius: var(--radius);
      cursor: pointer;
      color: var(--text-secondary);
      padding: 0;

      &:hover { background: var(--surface); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }

      span { font-size: 20px; }
    }

    .dialog-panel__body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }

    .dialog-panel__footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;

      &:empty { display: none; }
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes dialog-in {
      from { opacity: 0; transform: translate(-50%, -52%) scale(0.97); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .dialog-panel, .dialog-backdrop { animation: none; }
    }
  `],
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
