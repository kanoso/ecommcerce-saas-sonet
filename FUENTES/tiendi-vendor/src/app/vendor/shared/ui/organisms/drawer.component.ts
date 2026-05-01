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

export type DrawerPosition = 'right' | 'left';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'td-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    @if (visible()) {
      <div
        class="drawer-backdrop"
        (click)="closed.emit()"
        aria-hidden="true"
      ></div>

      <div
        #drawerPanel
        class="drawer-panel"
        [ngClass]="'drawer-panel--' + position()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (keydown.escape)="closed.emit()"
        (keydown)="onKeydown($event)"
      >
        <div class="drawer-panel__header">
          <h2 class="drawer-panel__title">{{ title() }}</h2>
          <button
            type="button"
            class="drawer-panel__close"
            aria-label="Cerrar"
            (click)="closed.emit()"
          >
            <span class="material-icons-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="drawer-panel__body">
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: [`
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 800;
      animation: fade-in 0.2s ease;
    }

    .drawer-panel {
      position: fixed;
      top: 0;
      bottom: 0;
      z-index: 801;
      width: min(360px, 90vw);
      background: var(--card);
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 40px rgba(0,0,0,0.2);

      &:focus { outline: none; }
    }

    .drawer-panel--right {
      right: 0;
      border-radius: var(--radius-lg) 0 0 var(--radius-lg);
      animation: slide-in-right 0.25s cubic-bezier(0.32, 0.72, 0, 1);
    }

    .drawer-panel--left {
      left: 0;
      border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
      animation: slide-in-left 0.25s cubic-bezier(0.32, 0.72, 0, 1);
    }

    .drawer-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .drawer-panel__title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .drawer-panel__close {
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

    .drawer-panel__body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes slide-in-right {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }

    @keyframes slide-in-left {
      from { transform: translateX(-100%); }
      to   { transform: translateX(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .drawer-panel, .drawer-backdrop { animation: none; }
    }
  `],
})
export class DrawerComponent implements AfterViewInit, OnChanges {
  title = input.required<string>();
  size = input<DrawerPosition>('right');
  position = input<DrawerPosition>('right');
  visible = input<boolean>(false);

  closed = output<void>();

  drawerPanel = viewChild<ElementRef<HTMLDivElement>>('drawerPanel');
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
    const panel = this.drawerPanel()?.nativeElement;
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
    const panel = this.drawerPanel()?.nativeElement;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }
}
