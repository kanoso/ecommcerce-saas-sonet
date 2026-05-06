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
  templateUrl: './staff-list.page.html',
  styleUrl: './staff-list.page.scss',
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
