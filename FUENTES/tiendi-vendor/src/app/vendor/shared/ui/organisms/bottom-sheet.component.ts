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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'td-bottom-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="sheet-backdrop"
        (click)="closed.emit()"
        aria-hidden="true"
      ></div>

      <div
        #sheetPanel
        class="sheet-panel"
        role="dialog"
        aria-modal="true"
        (keydown.escape)="closed.emit()"
        (keydown)="onKeydown($event)"
      >
        <div class="sheet-handle" aria-hidden="true"></div>
        <ng-content />
      </div>
    }
  `,
  styles: [`
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 900;
      animation: fade-in 0.2s ease;
    }

    .sheet-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 901;
      background: var(--card);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      padding: 8px 0 env(safe-area-inset-bottom, 16px);
      max-height: 85vh;
      overflow-y: auto;
      animation: slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1);

      &:focus { outline: none; }
    }

    .sheet-handle {
      width: 40px;
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      margin: 0 auto 12px;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .sheet-panel, .sheet-backdrop { animation: none; }
    }
  `],
})
export class BottomSheetComponent implements AfterViewInit, OnChanges {
  visible = input<boolean>(false);
  closed = output<void>();

  sheetPanel = viewChild<ElementRef<HTMLDivElement>>('sheetPanel');
  private previousFocus: HTMLElement | null = null;

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
    if (event.key === 'Tab') {
      this.trapTab(event);
    }
  }

  private trapTab(event: KeyboardEvent): void {
    const panel = this.sheetPanel()?.nativeElement;
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
    const panel = this.sheetPanel()?.nativeElement;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }
}
