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
  templateUrl: './staff-roles-info.component.html',
  styleUrl: './staff-roles-info.component.scss',
})
export class StaffRolesInfoComponent {
  protected readonly roles = ROLES;
  protected readonly perms = PERMS;
}
