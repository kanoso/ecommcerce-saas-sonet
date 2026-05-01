import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login">
      <div class="login__card">
        <div class="login__logo">
          <span class="login__logo-icon">🛍️</span>
          <span class="login__logo-text">Tiendi Vendor</span>
        </div>

        <h1 class="login__title">Bienvenido de vuelta</h1>
        <p class="login__subtitle">Ingresá a tu panel de vendedor</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login__form" novalidate>
          <div class="login__field">
            <label class="login__label" for="loginEmail">Email</label>
            <input
              id="loginEmail"
              type="email"
              formControlName="email"
              class="login__input"
              [class.login__input--error]="form.get('email')?.invalid && form.get('email')?.touched"
              placeholder="tu@email.com"
              autocomplete="email" />
            @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
              <p class="login__field-error">El email es obligatorio</p>
            }
            @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
              <p class="login__field-error">Ingresá un email válido</p>
            }
          </div>

          <div class="login__field">
            <label class="login__label" for="loginPassword">Contraseña</label>
            <input
              id="loginPassword"
              type="password"
              formControlName="password"
              class="login__input"
              [class.login__input--error]="form.get('password')?.invalid && form.get('password')?.touched"
              placeholder="••••••••"
              autocomplete="current-password" />
            @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
              <p class="login__field-error">La contraseña es obligatoria</p>
            }
          </div>

          @if (loginError) {
            <p class="login__error" role="alert">{{ loginError }}</p>
          }

          <button
            type="submit"
            class="login__submit"
            [disabled]="authStore.isLoading()">
            @if (authStore.isLoading()) {
              <span class="material-icons-outlined login__spinner">sync</span>
              Ingresando...
            } @else {
              Ingresar
            }
          </button>
        </form>

        <div class="login__hint">
          <p class="login__hint-title">🧪 Usuarios de prueba:</p>
          <ul class="login__hint-list">
            <li><code>carlos&#64;tiendi.app</code> — STORE_OWNER</li>
            <li><code>maria&#64;tiendi.app</code> — MANAGER</li>
            <li><code>juan&#64;tiendi.app</code> — CASHIER</li>
            <li><code>rosa&#64;tiendi.app</code> — WAREHOUSE</li>
          </ul>
          <p class="login__hint-pwd">Password: cualquiera</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--surface);
    }

    .login {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    .login__card {
      width: 100%;
      max-width: 440px;
      background: var(--card);
      border-radius: var(--radius-lg);
      padding: 40px 36px;
      box-shadow: var(--shadow-md);
    }

    .login__logo {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
    }

    .login__logo-icon {
      font-size: 32px;
    }

    .login__logo-text {
      font-size: 20px;
      font-weight: 700;
      color: var(--primary);
    }

    .login__title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .login__subtitle {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0 0 24px;
    }

    .login__form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .login__field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .login__label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .login__input {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--card);
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
      width: 100%;
      box-sizing: border-box;
    }

    .login__input:focus {
      border-color: var(--primary);
    }

    .login__input--error {
      border-color: var(--danger);
    }

    .login__field-error {
      font-size: 12px;
      color: var(--danger);
      margin: 0;
    }

    .login__error {
      font-size: 13px;
      color: var(--danger);
      background: #FEF2F2;
      border-radius: var(--radius);
      padding: 8px 12px;
      margin: 0;
    }

    .login__submit {
      width: 100%;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: var(--radius);
      padding: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 4px;
    }

    .login__submit:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .login__submit:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .login__spinner {
      font-size: 18px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .login__hint {
      background: var(--surface);
      border-radius: 8px;
      padding: 12px;
      margin-top: 16px;
      font-size: 12px;
    }

    .login__hint-title {
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 6px;
    }

    .login__hint-list {
      list-style: none;
      margin: 0 0 6px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
      color: var(--text-secondary);
    }

    .login__hint-list code {
      font-family: monospace;
      color: var(--primary-dark);
    }

    .login__hint-pwd {
      color: var(--text-secondary);
      margin: 0;
    }

    @media (max-width: 480px) {
      .login__card {
        padding: 28px 20px;
      }
    }
  `],
})
export class LoginPage implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  loginError: string | null = null;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        void this.router.navigate(['/vendor/dashboard']);
      }
    });
  }

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      void this.router.navigate(['/vendor/dashboard']);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loginError = null;

    const { email, password } = this.form.getRawValue();

    try {
      await this.authStore.login(email, password);
    } catch {
      this.loginError = 'Credenciales incorrectas. Verificá tu email y contraseña.';
    }
  }
}
