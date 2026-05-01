import {
  ChangeDetectionStrategy, Component, inject, OnInit, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StaffStore, StaffMember, StaffRole } from '../staff.store';
import { StaffSlotsBannerComponent } from '../components/staff-slots-banner.component';
import { StaffTableComponent } from '../components/staff-table.component';
import { StaffRolesInfoComponent } from '../components/staff-roles-info.component';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  MANAGER:   'Gestión de pedidos, productos y clientes. No puede modificar suscripción.',
  CASHIER:   'Puede ver y gestionar pedidos únicamente. Sin acceso a configuración.',
  WAREHOUSE: 'Puede actualizar stock de productos. Sin acceso a ventas ni configuración.',
};

@Component({
  selector: 'app-staff-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    StaffSlotsBannerComponent,
    StaffTableComponent,
    StaffRolesInfoComponent,
  ],
  template: `
    <div class="staff-page">

      <app-staff-slots-banner
        [used]="store.usedSlots()"
        [max]="store.maxSlots()"
      />

      <div class="toolbar">
        <div>
          <h2 class="toolbar__title">Miembros del equipo</h2>
          <div class="toolbar__sub">
            {{ store.activeMembers().length }} activos
            @if (store.pendingMembers().length > 0) {
              · {{ store.pendingMembers().length }} invitación{{ store.pendingMembers().length > 1 ? 'es' : '' }} pendiente{{ store.pendingMembers().length > 1 ? 's' : '' }}
            }
          </div>
        </div>
        <button
          class="btn btn--primary"
          [disabled]="store.slotsAvailable() <= 0"
          (click)="openInviteModal()"
        >
          <span class="material-icons-outlined" style="font-size:16px">person_add</span>
          Invitar colaborador
        </button>
      </div>

      @if (store.isLoading()) {
        <div class="loading">Cargando equipo...</div>
      } @else {
        <app-staff-table
          [members]="store.members()"
          (changeRole)="openChangeRoleModal($event)"
          (remove)="onRemove($event)"
          (resend)="onResend($event)"
        />
      }

      <app-staff-roles-info style="margin-top:20px;display:block" />

      @if (store.error()) {
        <div class="error-banner" role="alert">{{ store.error() }}</div>
      }
    </div>

    @if (store.successMessage()) {
      <div class="toast" role="status">
        <span class="material-icons-outlined" style="font-size:18px">check_circle</span>
        {{ store.successMessage() }}
      </div>
    }

    <!-- MODAL: INVITAR -->
    @if (inviteOpen()) {
      <div class="overlay" (click)="closeInviteModal()" (keydown.escape)="closeInviteModal()" role="presentation">
        <div class="modal" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
          <div class="modal__header">
            <h3 id="invite-modal-title">Invitar colaborador</h3>
            <button type="button" class="icon-btn" (click)="closeInviteModal()">
              <span class="material-icons-outlined">close</span>
            </button>
          </div>
          <form [formGroup]="inviteForm" (ngSubmit)="onInviteSubmit()" class="modal__body">
            <div class="form-group">
              <label class="form-label" for="invite-list-email">Email <span class="req">*</span></label>
              <input id="invite-list-email" type="email" class="form-input" placeholder="colaborador@ejemplo.com" formControlName="email">
              @if (inviteForm.get('email')?.invalid && inviteForm.get('email')?.touched) {
                <div class="form-error">Email válido requerido</div>
              }
            </div>
            <div class="form-group">
              <label class="form-label" for="invite-list-role">Rol <span class="req">*</span></label>
              <select id="invite-list-role" class="form-input" formControlName="role">
                <option value="">Seleccionar rol...</option>
                <option value="MANAGER">Gerente</option>
                <option value="CASHIER">Cajero/a</option>
                <option value="WAREHOUSE">Depósito</option>
              </select>
              @if (inviteRoleDesc()) {
                <div class="form-hint">{{ inviteRoleDesc() }}</div>
              }
            </div>
            <div class="info-note">
              <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">info</span>
              El colaborador recibirá un email para aceptar la invitación y crear su contraseña.
            </div>
            <div class="modal__actions">
              <button type="button" class="btn btn--ghost" (click)="closeInviteModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="store.isSaving()">
                @if (store.isSaving()) { Enviando... } @else { Enviar invitación }
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- MODAL: CAMBIAR ROL -->
    @if (changeRoleOpen() && editingMember()) {
      <div class="overlay" (click)="closeChangeRoleModal()" (keydown.escape)="closeChangeRoleModal()" role="presentation">
        <div class="modal modal--sm" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="change-role-title">
          <div class="modal__header">
            <h3 id="change-role-title">Cambiar rol — {{ editingMember()!.name }}</h3>
            <button type="button" class="icon-btn" (click)="closeChangeRoleModal()">
              <span class="material-icons-outlined">close</span>
            </button>
          </div>
          <form [formGroup]="changeRoleForm" (ngSubmit)="onChangeRoleSubmit()" class="modal__body">
            <div class="form-group">
              <label class="form-label" for="change-role-select">Nuevo rol</label>
              <select id="change-role-select" class="form-input" formControlName="role">
                <option value="MANAGER">Gerente</option>
                <option value="CASHIER">Cajero/a</option>
                <option value="WAREHOUSE">Depósito</option>
              </select>
            </div>
            <div class="modal__actions">
              <button type="button" class="btn btn--ghost" (click)="closeChangeRoleModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="store.isSaving()">
                @if (store.isSaving()) { Guardando... } @else { Guardar }
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- CONFIRM: QUITAR MIEMBRO -->
    @if (confirmRemoveMember()) {
      <div class="overlay" (click)="cancelRemove()" (keydown.escape)="cancelRemove()" role="presentation">
        <div class="modal modal--sm" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="remove-member-title">
          <div class="modal__header">
            <h3 id="remove-member-title">Quitar miembro</h3>
            <button type="button" class="icon-btn" (click)="cancelRemove()">
              <span class="material-icons-outlined">close</span>
            </button>
          </div>
          <div class="modal__body">
            <p class="confirm-text">
              ¿Quitar a <strong>{{ confirmRemoveMember()!.name }}</strong> del equipo?
              Esta acción no se puede deshacer.
            </p>
            <div class="modal__actions">
              <button type="button" class="btn btn--ghost" (click)="cancelRemove()">Cancelar</button>
              <button type="button" class="btn btn--danger-outline" (click)="confirmRemove()" [disabled]="store.isSaving()">
                Quitar
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .staff-page { padding: 24px; max-width: 1280px; margin: 0 auto; }

    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .toolbar__title { font-size: 16px; font-weight: 600; margin: 0 0 2px; }
    .toolbar__sub { font-size: 13px; color: var(--text-muted); }

    .loading { text-align: center; padding: 48px; color: var(--text-muted); font-size: 14px; }
    .error-banner { margin-top: 16px; background: #FEE2E2; border: 1px solid #FECACA; border-radius: var(--radius); padding: 12px 16px; font-size: 13px; color: var(--danger); }

    .toast { position: fixed; bottom: 24px; right: 24px; background: var(--primary); color: #fff; padding: 12px 20px; border-radius: var(--radius); font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.15); z-index: 999; animation: slideIn .2s ease; }
    @keyframes slideIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal { background: #fff; border-radius: var(--radius-lg); padding: 28px; width: 100%; max-width: 440px; }
    .modal--sm { max-width: 380px; }
    .modal__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal__header h3 { margin: 0; font-size: 16px; font-weight: 600; }
    .modal__body { display: flex; flex-direction: column; gap: 16px; }
    .modal__actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }

    .icon-btn { width: 32px; height: 32px; border: none; background: transparent; cursor: pointer; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
    .icon-btn:hover { background: var(--surface); }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 500; }
    .form-input { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; color: var(--text); background: #fff; width: 100%; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: var(--primary); }
    select.form-input { cursor: pointer; }
    .form-error { font-size: 12px; color: var(--danger); }
    .form-hint { font-size: 12px; color: var(--text-muted); }
    .req { color: var(--danger); }
    .info-note { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius); padding: 10px 12px; font-size: 12px; color: #92400E; }
    .confirm-text { font-size: 14px; color: var(--text); margin: 0; }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: background 0.15s; }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn--ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn--ghost:hover { background: var(--surface); }
    .btn--danger-outline { background: transparent; border: 1px solid var(--danger); color: var(--danger); }
    .btn--danger-outline:hover:not(:disabled) { background: #FEF2F2; }
    .btn--danger-outline:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 640px) { .staff-page { padding: 16px; } }
  `],
})
export class StaffListPage implements OnInit {
  protected readonly store = inject(StaffStore);
  private readonly fb = inject(FormBuilder);

  inviteOpen            = signal(false);
  changeRoleOpen        = signal(false);
  editingMember         = signal<StaffMember | null>(null);
  confirmRemoveMember   = signal<StaffMember | null>(null);

  inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role:  ['', Validators.required],
  });

  changeRoleForm = this.fb.nonNullable.group({
    role: ['MANAGER'],
  });

  ngOnInit(): void { this.store.loadStaff(); }

  inviteRoleDesc(): string {
    return ROLE_DESCRIPTIONS[this.inviteForm.get('role')?.value ?? ''] ?? '';
  }

  openInviteModal(): void {
    this.inviteForm.reset({ email: '', role: '' });
    this.inviteOpen.set(true);
  }
  closeInviteModal(): void { this.inviteOpen.set(false); }

  onInviteSubmit(): void {
    if (this.inviteForm.invalid) { this.inviteForm.markAllAsTouched(); return; }
    const { email, role } = this.inviteForm.getRawValue();
    this.store.inviteMember(email, role as StaffRole);
    this.closeInviteModal();
  }

  openChangeRoleModal(member: StaffMember): void {
    this.editingMember.set(member);
    this.changeRoleForm.patchValue({ role: member.role });
    this.changeRoleOpen.set(true);
  }
  closeChangeRoleModal(): void { this.changeRoleOpen.set(false); this.editingMember.set(null); }

  onChangeRoleSubmit(): void {
    const member = this.editingMember();
    if (!member) return;
    this.store.changeRole(member.id, this.changeRoleForm.getRawValue().role as StaffRole);
    this.closeChangeRoleModal();
  }

  onRemove(member: StaffMember): void   { this.confirmRemoveMember.set(member); }
  cancelRemove(): void                   { this.confirmRemoveMember.set(null); }
  confirmRemove(): void {
    const m = this.confirmRemoveMember();
    if (m) { this.store.removeMember(m.id); this.confirmRemoveMember.set(null); }
  }

  onResend(member: StaffMember): void { this.store.resendInvite(member.email); }
}
