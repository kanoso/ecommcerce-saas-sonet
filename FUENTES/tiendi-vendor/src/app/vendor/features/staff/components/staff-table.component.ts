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
  template: `
    <div class="card">
      <div class="table-wrap">
        <table class="staff-table">
          <thead>
            <tr>
              <th>Miembro</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (member of members(); track member.id) {
              <tr [class.row--pending]="member.status === 'PENDING'">
                <td>
                  <div class="member-cell">
                    <div
                      class="avatar"
                      [class.avatar--pending]="member.status === 'PENDING'"
                    >{{ member.initials }}</div>
                    <div>
                      <div class="member-name">
                        @if (member.status === 'PENDING') { {{ member.email }} }
                        @else { {{ member.name }} }
                      </div>
                      <div class="member-sub">
                        @if (member.status === 'PENDING') { (pendiente de aceptar) }
                        @else { {{ member.email }} }
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="role-tag" [class]="'role-tag--' + member.role.toLowerCase()">
                    {{ roleLabel(member.role) }}
                  </span>
                </td>
                <td>
                  @if (member.status === 'ACTIVE') {
                    <span class="status-active">
                      <span class="status-dot"></span>Activo
                    </span>
                  } @else {
                    <span class="status-pending">⏳ Invitación pendiente</span>
                  }
                </td>
                <td>
                  @if (member.role === 'STORE_OWNER') {
                    <span class="no-actions">Sin acciones</span>
                  } @else if (member.status === 'PENDING') {
                    <div class="actions-cell">
                      <button class="btn btn--ghost btn--sm" (click)="resend.emit(member)">Reenviar</button>
                      <button class="btn btn--ghost btn--sm btn--danger" (click)="remove.emit(member)">Cancelar</button>
                    </div>
                  } @else {
                    <div class="actions-cell">
                      <button class="btn btn--ghost btn--sm" (click)="changeRole.emit(member)">Cambiar rol</button>
                      <button class="btn btn--ghost btn--sm btn--danger" (click)="remove.emit(member)">Quitar</button>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .table-wrap { overflow-x: auto; }

    .staff-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .staff-table th { padding: 12px 16px; text-align: left; font-weight: 600; font-size: 12px; color: var(--text-muted); background: var(--surface); border-bottom: 1px solid var(--border); white-space: nowrap; }
    .staff-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .staff-table tr:last-child td { border-bottom: none; }
    .staff-table tr:hover td { background: var(--surface); }

    .row--pending td { background: #FFFBEB; }
    .row--pending:hover td { background: #FEF3C7; }

    .member-cell { display: flex; align-items: center; gap: 10px; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .avatar--pending { background: #F59E0B; }
    .member-name { font-weight: 500; font-size: 14px; }
    .member-sub { font-size: 12px; color: var(--text-muted); margin-top: 1px; }

    .role-tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: .04em; }
    .role-tag--store_owner { background: #EDE9FE; color: #5B21B6; }
    .role-tag--manager     { background: #DBEAFE; color: #1E40AF; }
    .role-tag--cashier     { background: #D1FAE5; color: #065F46; }
    .role-tag--warehouse   { background: #FEF3C7; color: #92400E; }

    .status-active { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); display: inline-block; }
    .status-pending { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; background: #FEF3C7; color: #92400E; padding: 3px 10px; border-radius: 20px; font-weight: 500; }

    .no-actions { font-size: 12px; color: var(--text-muted); }
    .actions-cell { display: flex; gap: 6px; flex-wrap: wrap; }

    .btn { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: var(--radius); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: transparent; transition: background 0.15s; white-space: nowrap; }
    .btn--ghost { color: var(--text); }
    .btn--ghost:hover { background: var(--surface); }
    .btn--danger { color: #B91C1C; }
    .btn--danger:hover { background: #FEF2F2; border-color: #FECACA; }
    .btn--sm { padding: 5px 10px; font-size: 12px; }
  `],
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
