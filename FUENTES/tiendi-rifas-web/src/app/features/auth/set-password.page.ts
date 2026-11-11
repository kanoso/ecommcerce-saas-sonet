import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { AuthApi } from '../../core/api/auth-api';
import { RETURN_PATH_PARAM } from '../../core/session/return-path';

type SetPasswordStatus = 'idle' | 'sending' | 'saved' | 'has-password' | 'expired' | 'error';

/** Same bounds as the API (`POST /auth/contrasena`). */
const MIN_LENGTH = 6;
const MAX_LENGTH = 100;

export const SET_PASSWORD_PATH = '/cuenta/contrasena';

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };

/** Route `/cuenta/contrasena`: an account without a password (link or Google) adds one. */
@Component({
  selector: 'app-set-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './set-password.page.html',
  styleUrl: './auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPasswordPage {
  private readonly auth = inject(AuthApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<SetPasswordStatus>('idle');
  protected readonly errorMessage = signal('');
  protected readonly showInvalid = signal(false);
  protected readonly signInParams = { [RETURN_PATH_PARAM]: SET_PASSWORD_PATH };

  protected readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(MIN_LENGTH), Validators.maxLength(MAX_LENGTH)],
      }),
      confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: passwordsMatch },
  );

  protected get lengthInvalid(): boolean {
    return this.form.controls.password.invalid;
  }

  protected submit(): void {
    if (this.status() === 'sending') {
      return;
    }
    if (this.form.invalid) {
      this.showInvalid.set(true);
      return;
    }
    this.showInvalid.set(false);
    this.errorMessage.set('');
    this.status.set('sending');
    this.auth
      .setPassword(this.form.controls.password.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => {
          this.form.reset();
          this.status.set('saved');
        },
        error: (error: unknown) => {
          const apiError = toApiError(error);
          if (apiError.status === 409) {
            this.status.set('has-password');
          } else if (apiError.status === 401) {
            this.status.set('expired');
          } else {
            this.errorMessage.set(apiError.userMessage);
            this.status.set('error');
          }
        },
      });
  }
}
