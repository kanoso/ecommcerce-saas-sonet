import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface UiState {
  isOffline: boolean;
  isStoreSuspended: boolean;
  globalLoading: number;
  toasts: Toast[];
}

export const UiStore = signalStore(
  { providedIn: 'root' },
  withState<UiState>({
    isOffline: false,
    isStoreSuspended: false,
    globalLoading: 0,
    toasts: [],
  }),
  withComputed(({ globalLoading }) => ({
    isLoading: computed(() => globalLoading() > 0),
  })),
  withMethods((store) => ({
    addToast(toast: Omit<Toast, 'id'>): void {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      patchState(store, { toasts: [...store.toasts(), { ...toast, id }] });

      const duration = toast.duration ?? 4000;
      if (duration > 0) {
        setTimeout(() => {
          patchState(store, {
            toasts: store.toasts().filter((t) => t.id !== id),
          });
        }, duration);
      }
    },

    removeToast(id: string): void {
      patchState(store, { toasts: store.toasts().filter((t) => t.id !== id) });
    },

    setOffline(value: boolean): void {
      patchState(store, { isOffline: value });
    },

    setStoreSuspended(value: boolean): void {
      patchState(store, { isStoreSuspended: value });
    },

    incrementLoading(): void {
      patchState(store, { globalLoading: store.globalLoading() + 1 });
    },

    decrementLoading(): void {
      patchState(store, { globalLoading: Math.max(0, store.globalLoading() - 1) });
    },
  })),
);
