import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, NgZone, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GOOGLE_CLIENT_ID } from '../../core/api/api-config';
import { toApiError } from '../../core/api/api-error';
import { AuthApi } from '../../core/api/auth-api';
import { Session } from '../../core/api/api.models';
import { RETURN_PATH_PARAM, ReturnPathStore } from '../../core/session/return-path';
import { SessionStore } from '../../core/session/session.store';

declare const google: {
  accounts?: {
    id?: {
      initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

type RequestStatus = 'idle' | 'sending' | 'sent' | 'error';
type AuthTab = 'login' | 'register';


/** Route `/ingresar`: login or register via DNI/phone/email, Google or magic link. */
@Component({
  selector: 'app-request-link-page',
  imports: [ReactiveFormsModule],
  templateUrl: './request-link.page.html',
  styleUrl: './auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestLinkPage implements AfterViewInit {
  private readonly auth = inject(AuthApi);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly returnPath = inject(ReturnPathStore);
  private readonly ngZone = inject(NgZone);
  private readonly googleClientId = inject(GOOGLE_CLIENT_ID);

  protected readonly tab = signal<AuthTab>('login');
  protected readonly status = signal<RequestStatus>('idle');
  protected readonly sentTo = signal('');
  protected readonly errorMessage = signal('');
  protected readonly showInvalid = signal(false);
  protected readonly showMagicLink = signal(false);

  // Magic link form
  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email, Validators.maxLength(254)],
  });

  // Login form
  protected readonly loginIdentifier = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly loginPassword = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  // Register form
  protected readonly regName = new FormControl('', { nonNullable: true });
  protected readonly regIdentifier = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly regPassword = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6)],
  });

  ngAfterViewInit(): void {
    this.initGoogleButtons();
  }

  protected setTab(t: AuthTab): void {
    this.tab.set(t);
    this.showInvalid.set(false);
    this.errorMessage.set('');
    this.status.set('idle');
    setTimeout(() => this.initGoogleButtons(), 50);
  }

  protected toggleMagicLink(): void {
    this.showMagicLink.update((v) => !v);
  }

  protected resetStatus(): void {
    this.status.set('idle');
    this.errorMessage.set('');
  }

  private initGoogleButtons(): void {
    if (typeof google === 'undefined' || !google.accounts?.id) {
      setTimeout(() => {
        if (typeof google !== 'undefined' && google.accounts?.id) {
          this.renderGoogleButton();
        }
      }, 500);
      return;
    }
    this.renderGoogleButton();
  }

  private renderGoogleButton(): void {
    if (typeof google === 'undefined' || !google.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: this.googleClientId,
      callback: (res: { credential?: string }) => {
        if (res.credential) {
          this.ngZone.run(() => this.handleGoogleCredential(res.credential!));
        }
      },
    });

    const containerId = this.tab() === 'login' ? 'google-btn-container' : 'google-btn-container-reg';
    const container = document.getElementById(containerId);
    if (container) {
      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
      });
    }
  }

  private handleGoogleCredential(credential: string): void {
    this.returnPath.remember(this.route.snapshot.queryParamMap.get(RETURN_PATH_PARAM));
    this.status.set('sending');
    this.auth
      .loginWithGoogle(credential)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => this.finishSignIn(session),
        error: (error: unknown) => {
          this.errorMessage.set(toApiError(error).userMessage);
          this.status.set('error');
        },
      });
  }

  protected submitLogin(): void {
    this.loginIdentifier.setValue(this.loginIdentifier.value.trim());
    if (this.loginIdentifier.invalid || this.loginPassword.invalid) {
      this.showInvalid.set(true);
      return;
    }
    this.showInvalid.set(false);
    this.returnPath.remember(this.route.snapshot.queryParamMap.get(RETURN_PATH_PARAM));
    this.status.set('sending');

    this.auth
      .login(this.loginIdentifier.value, this.loginPassword.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => this.finishSignIn(session),
        error: (error: unknown) => {
          this.errorMessage.set(toApiError(error).userMessage);
          this.status.set('error');
        },
      });
  }

  protected submitRegister(): void {
    this.regIdentifier.setValue(this.regIdentifier.value.trim());
    if (this.regIdentifier.invalid || this.regPassword.invalid) {
      this.showInvalid.set(true);
      return;
    }
    this.showInvalid.set(false);
    this.returnPath.remember(this.route.snapshot.queryParamMap.get(RETURN_PATH_PARAM));
    this.status.set('sending');

    this.auth
      .register(this.regIdentifier.value, this.regPassword.value, this.regName.value.trim() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => this.finishSignIn(session),
        error: (error: unknown) => {
          this.errorMessage.set(toApiError(error).userMessage);
          this.status.set('error');
        },
      });
  }

  protected submitMagicLink(): void {
    this.email.setValue(this.email.value.trim());
    if (this.email.invalid) {
      this.showInvalid.set(true);
      return;
    }
    this.showInvalid.set(false);
    this.returnPath.remember(this.route.snapshot.queryParamMap.get(RETURN_PATH_PARAM));
    this.status.set('sending');
    const address = this.email.value;
    this.auth
      .requestLink(address)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => {
          this.sentTo.set(address);
          this.status.set('sent');
        },
        error: (error: unknown) => {
          this.errorMessage.set(toApiError(error).userMessage);
          this.status.set('error');
        },
      });
  }

  private finishSignIn(session: Session): void {
    if (!this.session.signIn(session)) {
      this.errorMessage.set('No se pudo iniciar sesión.');
      this.status.set('error');
      return;
    }
    void this.router.navigateByUrl(this.returnPath.consume() ?? '/', { replaceUrl: true });
  }
}
