import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApi } from '../../core/api/admin-api';
import { ApiError } from '../../core/api/api-error';

const FALLBACK_ERROR = 'No se pudo abrir el comprobante. Intenta nuevamente.';

/**
 * The only types rendered inline. Anything else (e.g. text/html or
 * image/svg+xml) could run script in the app origin from a blob URL, so it is
 * only ever downloaded as an opaque file.
 */
const INLINE_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

const SAFE_DOWNLOAD_TYPE = 'application/octet-stream';

/** `Image/PNG; charset=x` -> `image/png`. */
function essenceOf(type: string): string {
  return type.split(';')[0].trim().toLowerCase();
}

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
          if (tab) {
            this.pendingTabs.delete(tab);
          }
          const type = essenceOf(blob.type);
          if (INLINE_TYPES.has(type)) {
            const url = this.objectUrlFor(new Blob([blob], { type }));
            if (tab) {
              tab.opener = null;
              tab.location.href = url;
            } else {
              this.download(url, filename);
            }
          } else {
            tab?.close();
            const url = this.objectUrlFor(new Blob([blob], { type: SAFE_DOWNLOAD_TYPE }));
            this.download(url, `comprobante-${orderId}`);
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

  private objectUrlFor(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    return url;
  }

  private download(url: string, filename: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
  }
}
