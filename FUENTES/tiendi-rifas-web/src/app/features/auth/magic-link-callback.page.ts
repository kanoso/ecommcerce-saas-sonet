import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiError, userMessageFor } from '../../core/api/api-error';
import { AuthApi } from '../../core/api/auth-api';
import { ReturnPathStore } from '../../core/session/return-path';
import { SessionStore } from '../../core/session/session.store';

/** Reads `token` from a URL fragment such as `token=abc`. */
export function tokenFromFragment(fragment: string | null): string | null {
  return fragment ? new URLSearchParams(fragment).get('token') : null;
}

/**
 * Route `/acceso`: the page the emailed link opens (`/acceso#token=…`,
 * MAGIC_LINK_BASE_URL in the API). The token rides in the fragment, so it
 * never reaches a server log; this page trades it for a session once.
 */
@Component({
  selector: 'app-magic-link-callback-page',
  imports: [RouterLink],
  templateUrl: './magic-link-callback.page.html',
  styleUrl: './auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MagicLinkCallbackPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthApi);
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly returnPath = inject(ReturnPathStore);

  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = tokenFromFragment(this.route.snapshot.fragment);
    // The token leaves the address bar and the history at once, before the
    // exchange, so it is gone whether the exchange succeeds or fails.
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: undefined,
      replaceUrl: true,
    });
    if (!token) {
      this.errorMessage.set(userMessageFor('MAGIC_LINK_INVALID'));
      return;
    }
    this.auth
      .openSession(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          if (!this.session.signIn(session)) {
            // Only a clock far ahead of the server gets here.
            this.errorMessage.set(userMessageFor('UNAUTHORIZED'));
            return;
          }
          // consume() only ever yields an internal path, never another site.
          void this.router.navigateByUrl(this.returnPath.consume() ?? '/', { replaceUrl: true });
        },
        error: (error: unknown) => this.errorMessage.set(toApiError(error).userMessage),
      });
  }
}
