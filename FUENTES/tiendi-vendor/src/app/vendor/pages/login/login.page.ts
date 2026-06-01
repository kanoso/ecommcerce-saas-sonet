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
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
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
        const dest = this.authStore.isSuperAdmin() ? '/vendor/riders' : '/vendor/dashboard';
        void this.router.navigate([dest]);
      }
    });
  }

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      const dest = this.authStore.isSuperAdmin() ? '/vendor/riders' : '/vendor/dashboard';
      void this.router.navigate([dest]);
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
