import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  MAX_SCALE,
  MIN_SCALE,
  Point,
  ZOOM_STEP,
  clampPan,
  clampScale,
  pinchScale,
  toggleScale,
  wheelScale,
} from './image-zoom.model';

/** Max time between two taps for a double-tap, in ms. */
const DOUBLE_TAP_MS = 300;
/** Movement under this many px still counts as a tap, not a drag. */
const TAP_SLOP_PX = 8;

interface Gesture {
  startScale: number;
  startPan: Point;
  startPoint: Point;
  startDistance: number;
  moved: boolean;
}

/**
 * Full-screen image viewer with zoom (buttons, wheel, double-click/tap,
 * pinch) and pan when zoomed in. Render it under an `@if` and remove it on
 * `closed`: it locks body scroll for as long as it exists.
 */
@Component({
  selector: 'app-image-lightbox',
  templateUrl: './image-lightbox.component.html',
  styleUrl: './image-lightbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(click)': 'onBackdropClick($event)',
  },
})
export class ImageLightboxComponent implements AfterViewInit {
  readonly images = input.required<string[]>();
  readonly startIndex = input(0);
  readonly alt = input('');
  readonly closed = output<void>();

  protected readonly minScale = MIN_SCALE;
  protected readonly maxScale = MAX_SCALE;

  private readonly document = inject(DOCUMENT);
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly backdrop = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly image = viewChild.required<ElementRef<HTMLImageElement>>('image');

  /** Offset from `startIndex`, so a new start index is honoured without an effect. */
  private readonly offset = signal(0);
  protected readonly index = computed(() => {
    const total = this.images().length;
    if (total === 0) return 0;
    const start = Math.min(Math.max(0, Math.trunc(this.startIndex())), total - 1);
    return (((start + this.offset()) % total) + total) % total;
  });
  protected readonly current = computed(() => this.images()[this.index()] ?? '');
  protected readonly hasMany = computed(() => this.images().length > 1);

  protected readonly scale = signal(MIN_SCALE);
  protected readonly pan = signal<Point>({ x: 0, y: 0 });
  protected readonly zoomed = computed(() => this.scale() > MIN_SCALE);
  protected readonly level = computed(() => `${Math.round(this.scale() * 100)}%`);
  protected readonly transform = computed(() => {
    const { x, y } = this.pan();
    return `translate(${x}px, ${y}px) scale(${this.scale()})`;
  });
  protected readonly dragging = signal(false);

  private readonly pointers = new Map<number, Point>();
  private gesture: Gesture | null = null;
  private suppressClick = false;
  private lastTap: { time: number; point: Point } | null = null;
  private lastTouchToggle = 0;

  constructor() {
    const body = this.document.body;
    const previousOverflow = body.style.overflow;
    const previousFocus = this.document.activeElement as HTMLElement | null;
    body.style.overflow = 'hidden';
    inject(DestroyRef).onDestroy(() => {
      body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    });
  }

  ngAfterViewInit(): void {
    this.closeButton().nativeElement.focus();
  }

  // Navigation

  protected next(): void {
    this.go(1);
  }

  protected prev(): void {
    this.go(-1);
  }

  private go(step: number): void {
    if (!this.hasMany()) return;
    this.offset.update((o) => o + step);
    this.reset();
  }

  // Zoom

  protected zoomIn(): void {
    this.zoomTo(this.scale() + ZOOM_STEP);
  }

  protected zoomOut(): void {
    this.zoomTo(this.scale() - ZOOM_STEP);
  }

  protected reset(): void {
    this.scale.set(MIN_SCALE);
    this.pan.set({ x: 0, y: 0 });
  }

  /**
   * Sets the scale keeping `focus` (px from the stage centre) still on
   * screen; without a focus point it zooms around the current centre.
   */
  private zoomTo(target: number, focus?: Point): void {
    const from = this.scale();
    const to = clampScale(target);
    if (to === MIN_SCALE) {
      this.reset();
      return;
    }
    const pan = this.pan();
    const ratio = to / from;
    const next = focus
      ? { x: focus.x - (focus.x - pan.x) * ratio, y: focus.y - (focus.y - pan.y) * ratio }
      : { x: pan.x * ratio, y: pan.y * ratio };
    this.scale.set(to);
    this.setPan(next);
  }

  private setPan(pan: Point): void {
    const stage = this.stage().nativeElement;
    const img = this.image().nativeElement;
    this.pan.set(
      clampPan(
        pan,
        this.scale(),
        { width: stage.clientWidth, height: stage.clientHeight },
        { width: img.offsetWidth, height: img.offsetHeight },
      ),
    );
  }

  /** Point of a pointer/mouse event relative to the stage centre. */
  private fromCentre(event: { clientX: number; clientY: number }): Point {
    const rect = this.stage().nativeElement.getBoundingClientRect();
    return { x: event.clientX - (rect.left + rect.width / 2), y: event.clientY - (rect.top + rect.height / 2) };
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomTo(wheelScale(this.scale(), event.deltaY), this.fromCentre(event));
  }

  protected onDoubleClick(event: MouseEvent): void {
    // A touch double-tap is already handled in onPointerUp.
    if (Date.now() - this.lastTouchToggle < 500) return;
    this.zoomTo(toggleScale(this.scale()), this.fromCentre(event));
  }

  // Pointer gestures: one pointer pans (when zoomed), two pointers pinch.

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // A stale flag from a gesture that produced no click must not swallow a later backdrop click.
    if (this.pointers.size === 0) this.suppressClick = false;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.startGesture();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId) || !this.gesture) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = this.gesture;
    const points = [...this.pointers.values()];

    if (points.length >= 2) {
      gesture.moved = true;
      this.scale.set(pinchScale(gesture.startScale, gesture.startDistance, distance(points[0], points[1])));
      if (this.scale() === MIN_SCALE) {
        this.pan.set({ x: 0, y: 0 });
      } else {
        this.setPan(this.pan());
      }
      return;
    }

    const dx = points[0].x - gesture.startPoint.x;
    const dy = points[0].y - gesture.startPoint.y;
    if (!gesture.moved && Math.hypot(dx, dy) > TAP_SLOP_PX) {
      gesture.moved = true;
    }
    if (gesture.moved && this.zoomed()) {
      this.dragging.set(true);
      this.setPan({ x: gesture.startPan.x + dx, y: gesture.startPan.y + dy });
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    const moved = this.gesture?.moved ?? false;
    const wasPinch = this.pointers.size >= 2;
    this.pointers.delete(event.pointerId);
    this.dragging.set(false);

    if (moved) {
      this.suppressClick = true;
    } else if (!wasPinch && event.type === 'pointerup' && event.pointerType !== 'mouse') {
      this.detectDoubleTap(event);
    }
    // A finger left a pinch: continue as a pan with the remaining one.
    this.gesture = null;
    if (this.pointers.size > 0) {
      this.startGesture();
      if (this.gesture) (this.gesture as Gesture).moved = moved;
    }
  }

  private startGesture(): void {
    const points = [...this.pointers.values()];
    this.gesture = {
      startScale: this.scale(),
      startPan: this.pan(),
      startPoint: points[0],
      startDistance: points.length >= 2 ? distance(points[0], points[1]) : 0,
      moved: false,
    };
  }

  private detectDoubleTap(event: PointerEvent): void {
    const now = Date.now();
    const point = { x: event.clientX, y: event.clientY };
    const last = this.lastTap;
    if (last && now - last.time < DOUBLE_TAP_MS && distance(last.point, point) < TAP_SLOP_PX * 3) {
      this.lastTap = null;
      this.lastTouchToggle = now;
      this.zoomTo(toggleScale(this.scale()), this.fromCentre(event));
    } else {
      this.lastTap = { time: now, point };
    }
  }

  // Closing

  /**
   * Closes only on clicks on the backdrop itself (overlay or empty stage),
   * never on the image or the controls, nor right after a drag.
   */
  protected onBackdropClick(event: MouseEvent): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const target = event.target;
    if (target === this.backdrop().nativeElement || target === this.stage().nativeElement) {
      this.close();
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.prev();
        break;
      case '+':
      case '=':
      case '-':
      case '0':
        // With Ctrl/Cmd these are the browser's own zoom: leave them alone.
        if (event.ctrlKey || event.metaKey) return;
        if (event.key === '-') this.zoomOut();
        else if (event.key === '0') this.reset();
        else this.zoomIn();
        break;
    }
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
