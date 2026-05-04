import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { StaffMember, StaffRole } from '../staff.store';

const ROLE_LABELS: Record<StaffRole, string> = {
  STORE_OWNER: 'DUEÑO',
  MANAGER:     'GERENTE',
  CASHIER:     'CAJERO/A',
  WAREHOUSE:   'DEPÓSITO',
  EMPLOYEE:    'EMPLEADO/A',
};

@Component({
  selector: 'app-staff-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-table.component.html',
  styleUrl: './staff-table.component.scss',
})
export class StaffTableComponent {
  members    = input.required<StaffMember[]>();
  changeRole = output<StaffMember>();
  remove     = output<StaffMember>();
  resend     = output<StaffMember>();

  roleLabel(role: StaffRole): string {
    return ROLE_LABELS[role] ?? role;
  }
}
