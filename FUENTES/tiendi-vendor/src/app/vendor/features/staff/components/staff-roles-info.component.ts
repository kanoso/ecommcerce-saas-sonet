import { ChangeDetectionStrategy, Component } from '@angular/core';

const ROLES = [
  { emoji: '👑', title: 'Dueño',               desc: 'Acceso completo a todas las funciones. No puede ser modificado.' },
  { emoji: '🏢', title: 'Gerente',              desc: 'Gestión de pedidos, productos y clientes. No puede modificar suscripción.' },
  { emoji: '💰', title: 'Cajero/a',             desc: 'Puede ver y gestionar pedidos únicamente. Sin acceso a configuración.' },
  { emoji: '📦', title: 'Depósito (WAREHOUSE)', desc: 'Puede ver productos y actualizar stock. Sin acceso a ventas ni configuración.' },
];

const PERMS: { module: string; owner: boolean; manager: boolean; cashier: boolean; warehouse: boolean }[] = [
  { module: 'Dashboard',             owner: true,  manager: true,  cashier: true,  warehouse: false },
  { module: 'Pedidos — ver',         owner: true,  manager: true,  cashier: true,  warehouse: false },
  { module: 'Pedidos — gestionar',   owner: true,  manager: true,  cashier: true,  warehouse: false },
  { module: 'Productos — ver',       owner: true,  manager: true,  cashier: false, warehouse: true  },
  { module: 'Productos — editar',    owner: true,  manager: true,  cashier: false, warehouse: false },
  { module: 'Stock — actualizar',    owner: true,  manager: true,  cashier: false, warehouse: true  },
  { module: 'Configuración tienda',  owner: true,  manager: true,  cashier: false, warehouse: false },
  { module: 'Analytics',             owner: true,  manager: true,  cashier: false, warehouse: false },
  { module: 'Clientes',              owner: true,  manager: true,  cashier: false, warehouse: false },
  { module: 'Staff',                 owner: true,  manager: false, cashier: false, warehouse: false },
  { module: 'Suscripción / Plan',    owner: true,  manager: false, cashier: false, warehouse: false },
  { module: 'Facturación y Legal',   owner: true,  manager: true,  cashier: false, warehouse: false },
];

@Component({
  selector: 'app-staff-roles-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="card__header"><h3>Descripción de roles</h3></div>
      <div class="card__body">
        <div class="roles-grid">
          @for (role of roles; track role.title) {
            <div class="role-card">
              <div class="role-card__title">{{ role.emoji }} {{ role.title }}</div>
              <div class="role-card__desc">{{ role.desc }}</div>
            </div>
          }
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="card__header"><h3>Matriz de permisos</h3></div>
      <div class="table-wrap">
        <table class="perms-table">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>STORE_OWNER</th>
              <th>MANAGER</th>
              <th>CASHIER</th>
              <th>WAREHOUSE</th>
            </tr>
          </thead>
          <tbody>
            @for (perm of perms; track perm.module) {
              <tr>
                <td>{{ perm.module }}</td>
                <td [class.perm--yes]="perm.owner"   [class.perm--no]="!perm.owner">   {{ perm.owner    ? '✓' : '✗' }}</td>
                <td [class.perm--yes]="perm.manager"  [class.perm--no]="!perm.manager"> {{ perm.manager  ? '✓' : '✗' }}</td>
                <td [class.perm--yes]="perm.cashier"  [class.perm--no]="!perm.cashier"> {{ perm.cashier  ? '✓' : '✗' }}</td>
                <td [class.perm--yes]="perm.warehouse"[class.perm--no]="!perm.warehouse">{{ perm.warehouse? '✓' : '✗' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .card__header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .card__header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .card__body { padding: 20px; }

    .roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .role-card { padding: 14px; background: var(--surface); border-radius: var(--radius-lg); }
    .role-card__title { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
    .role-card__desc { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

    .table-wrap { overflow-x: auto; }
    .perms-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .perms-table th { padding: 10px 16px; text-align: left; font-weight: 600; font-size: 12px; color: var(--text-muted); background: var(--surface); border-bottom: 1px solid var(--border); white-space: nowrap; }
    .perms-table td { padding: 10px 16px; border-bottom: 1px solid var(--border); }
    .perms-table tr:last-child td { border-bottom: none; }
    .perm--yes { color: var(--primary); font-weight: 700; text-align: center; }
    .perm--no  { color: var(--danger);  font-weight: 700; text-align: center; }
  `],
})
export class StaffRolesInfoComponent {
  protected readonly roles = ROLES;
  protected readonly perms = PERMS;
}
