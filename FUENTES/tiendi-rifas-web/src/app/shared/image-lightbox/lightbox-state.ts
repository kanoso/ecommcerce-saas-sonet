import { Signal, signal } from '@angular/core';

/** What an open lightbox shows. */
export interface LightboxState {
  images: string[];
  index: number;
  alt: string;
}

export interface Lightbox {
  /** Null while closed: render `<app-image-lightbox>` under an `@if` on it. */
  readonly state: Signal<LightboxState | null>;
  open(images: string[], index: number, alt: string): void;
  close(): void;
}

/** The host side of an ImageLightboxComponent: one per page. */
export function createLightbox(): Lightbox {
  const state = signal<LightboxState | null>(null);
  return {
    state: state.asReadonly(),
    open: (images, index, alt) => {
      if (images.length > 0) state.set({ images, index, alt });
    },
    close: () => state.set(null),
  };
}
