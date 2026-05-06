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
  templateUrl: './staff-invite.page.html',
  styleUrl: './staff-invite.page.scss',
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
