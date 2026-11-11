import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApi } from '../../core/api/admin-api';
import { ApiError } from '../../core/api/api-error';

const FALLBACK_ERROR = 'No se pudo abrir el comprobante. Intenta nuevamente.';

/**
 * Opens a payment proof for an operator. The file is fetched with HttpClient
 * (the auth interceptor adds `Authorization: Bearer`) and shown through an
 * object URL, so the session token never appears in a URL.
 *
 * Provide it in the component that uses it: the object URLs it creates are
 * revoked when that component is destroyed.
 */
@Injectable()
export class ProofViewer {
  private readonly adminApi = inject(AdminApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly objectUrls: string[] = [];
  private readonly pendingTabs = new Set<Window>();

  /** The order whose proof is being downloaded, if any. */
  readonly loadingId = signal<string | null>(null);
  /** User-facing message of the last failure. */
  readonly error = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.pendingTabs.forEach((tab) => tab.close());
      this.pendingTabs.clear();
      this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
      this.objectUrls.length = 0;
    });
  }

  /** Must run inside the click handler so the new tab is not blocked. */
  view(orderId: string): void {
    this.error.set(null);
    this.loadingId.set(orderId);
    // Opened synchronously, while the click still counts as a user gesture.
    const tab = window.open('', '_blank');
    if (tab) {
      this.pendingTabs.add(tab);
    }

    this.adminApi
      .proofFile(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          const url = URL.createObjectURL(blob);
          this.objectUrls.push(url);
          if (tab) {
            this.pendingTabs.delete(tab);
            tab.opener = null;
            tab.location.href = url;
          } else {
            this.download(url, filename);
          }
          this.loadingId.set(null);
        },
        error: (err: unknown) => {
          if (tab) {
            this.pendingTabs.delete(tab);
            tab.close();
          }
          this.error.set(err instanceof ApiError ? err.userMessage : FALLBACK_ERROR);
          this.loadingId.set(null);
        },
      });
  }

  private download(url: string, filename: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
  }
}
