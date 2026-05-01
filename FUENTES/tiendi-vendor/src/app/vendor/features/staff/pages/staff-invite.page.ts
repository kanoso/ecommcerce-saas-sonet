import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StaffStore, StaffRole } from '../staff.store';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  MANAGER:   'Gestión de pedidos, productos y clientes. No puede modificar suscripción.',
  CASHIER:   'Puede ver y gestionar pedidos únicamente. Sin acceso a configuración.',
  WAREHOUSE: 'Puede actualizar stock de productos. Sin acceso a ventas ni configuración.',
};

@Component({
  selector: 'app-staff-invite-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="invite-page">
      <div class="invite-card">
        <div class="invite-card__header">
          <button type="button" class="back-btn" (click)="goBack()">
            <span class="material-icons-outlined" style="font-size:18px">arrow_back</span>
            Volver al equipo
          </button>
          <h1 class="invite-card__title">Invitar colaborador</h1>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="invite-card__body">
          <div class="form-group">
            <label class="form-label" for="invite-email">Email del colaborador <span class="req">*</span></label>
            <input id="invite-email" type="email" class="form-input" placeholder="colaborador@ejemplo.com" formControlName="email">
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <div class="form-error">Ingresá un email válido</div>
            }
          </div>

          <div class="form-group">
            <label class="form-label" for="invite-role">Rol <span class="req">*</span></label>
            <select id="invite-role" class="form-input" formControlName="role">
              <option value="">Seleccionar rol...</option>
              <option value="MANAGER">Gerente</option>
              <option value="CASHIER">Cajero/a</option>
              <option value="WAREHOUSE">Depósito</option>
            </select>
            @if (form.get('role')?.invalid && form.get('role')?.touched) {
              <div class="form-error">Seleccioná un rol</div>
            }
            @if (roleDesc()) {
              <div class="form-hint">{{ roleDesc() }}</div>
            }
          </div>

          <div class="info-note">
            <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">info</span>
            El colaborador recibirá un email para aceptar la invitación y crear su contraseña.
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn--ghost" (click)="goBack()">Cancelar</button>
            <button type="submit" class="btn btn--primary" [disabled]="store.isSaving()">
              @if (store.isSaving()) { Enviando... } @else { Enviar invitación }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .invite-page { padding: 24px; max-width: 560px; margin: 0 auto; }

    .invite-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .invite-card__header { padding: 20px 24px; border-bottom: 1px solid var(--border); }
    .invite-card__title { margin: 12px 0 0; font-size: 18px; font-weight: 700; }
    .invite-card__body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }

    .back-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; font-size: 13px; color: var(--text-muted); padding: 0; }
    .back-btn:hover { color: var(--text); }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 500; }
    .form-input { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; color: var(--text); background: #fff; width: 100%; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: var(--primary); }
    select.form-input { cursor: pointer; }
    .form-error { font-size: 12px; color: var(--danger); }
    .form-hint { font-size: 12px; color: var(--text-muted); }
    .req { color: var(--danger); }

    .info-note { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius); padding: 10px 12px; font-size: 12px; color: #92400E; }

    .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn--ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn--ghost:hover { background: var(--surface); }
  `],
})
export class StaffInvitePage implements OnInit {
  protected readonly store = inject(StaffStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role:  ['', Validators.required],
  });

  ngOnInit(): void {
    if (!this.store.members().length) this.store.loadStaff();
  }

  roleDesc(): string {
    return ROLE_DESCRIPTIONS[this.form.get('role')?.value ?? ''] ?? '';
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { email, role } = this.form.getRawValue();
    this.store.inviteMember(email, role as StaffRole);
    void this.router.navigate(['/vendor/staff']);
  }

  goBack(): void { void this.router.navigate(['/vendor/staff']); }
}
