import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStore } from '../../../core/services/auth.store';
import { UiStore } from '../../../core/services/ui.store';

const ROLE_LABELS: Record<string, string> = {
  STORE_OWNER: 'Dueño',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero/a',
  WAREHOUSE: 'Depósito',
  SUPER_ADMIN: 'Super Admin',
};

const E164_PATTERN = /^\+?[1-9]\d{6,14}$/;
const URL_PATTERN =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;

@Component({
  selector: 'app-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage implements OnInit {
  protected readonly authStore = inject(AuthStore);
  private readonly ui = inject(UiStore);
  private readonly fb = inject(FormBuilder);

  // Transient UI state — lives here, not in AuthStore (VP-05, ADR-5)
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveOk = signal(false);

  protected readonly currentUser = computed(() => this.authStore.currentUser());
  protected readonly roleLabel = computed(() => {
    const role = this.currentUser()?.role ?? '';
    return ROLE_LABELS[role] ?? role;
  });
  protected readonly formattedCreatedAt = computed(() => {
    const raw = this.currentUser()?.createdAt;
    if (!raw) return '';
    return new Date(raw).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  protected readonly form = this.fb.group({
    firstName: [
      '',
      [Validators.required, Validators.minLength(2)],
    ],
    lastName: [
      '',
      [Validators.required, Validators.minLength(2)],
    ],
    phone: [
      null as string | null,
      [Validators.pattern(E164_PATTERN)],
    ],
    avatarUrl: [
      null as string | null,
      [Validators.pattern(URL_PATTERN)],
    ],
  });

  ngOnInit(): void {
    const user = this.currentUser();
    if (user) {
      this.form.patchValue({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        phone: user.phone ?? null,
        avatarUrl: user.avatar ?? null,
      });
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isSaving()) return;

    this.saveError.set(null);
    this.saveOk.set(false);
    this.isSaving.set(true);
    this.form.disable();

    const { firstName, lastName, phone, avatarUrl } = this.form.getRawValue();

    // Build partial DTO — send null explicitly to clear nullable fields
    const dto: Record<string, string | null | undefined> = {};
    if (firstName) dto['firstName'] = firstName;
    if (lastName) dto['lastName'] = lastName;
    dto['phone'] = phone ?? null;
    dto['avatarUrl'] = avatarUrl ?? null;

    try {
      await this.authStore.updateMe(dto);
      this.saveOk.set(true);
      // Auto-hide success message after 3 s
      setTimeout(() => this.saveOk.set(false), 3000);
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        this.ui.addToast({ message: 'Este teléfono ya está en uso por otra cuenta.', type: 'error' });
      } else {
        const message =
          err instanceof Error ? err.message : 'Error al guardar el perfil.';
        this.saveError.set(message);
      }
    } finally {
      this.isSaving.set(false);
      this.form.enable();
    }
  }
}
