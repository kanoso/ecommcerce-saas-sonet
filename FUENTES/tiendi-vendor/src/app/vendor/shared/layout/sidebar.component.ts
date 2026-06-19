import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BadgeComponent } from '../ui/atoms/badge.component';
import type { Role } from '../../core/types';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',           icon: 'dashboard',        route: '/vendor/dashboard',    roles: ['STORE_OWNER', 'MANAGER', 'CASHIER', 'SUPER_ADMIN'] },
  { label: 'Pedidos',             icon: 'receipt_long',     route: '/vendor/orders',       roles: ['STORE_OWNER', 'MANAGER', 'CASHIER', 'SUPER_ADMIN'] },
  { label: 'Productos',           icon: 'inventory_2',      route: '/vendor/products',     roles: ['STORE_OWNER', 'MANAGER', 'WAREHOUSE', 'SUPER_ADMIN'] },
  { label: 'Mi Tienda',           icon: 'store',            route: '/vendor/store',        roles: ['STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'] },
  { label: 'Analytics',           icon: 'bar_chart',        route: '/vendor/analytics',    roles: ['STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'] },
  { label: 'Clientes',            icon: 'group',            route: '/vendor/customers',    roles: ['STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'] },
  { label: 'Notificaciones',      icon: 'notifications',    route: '/vendor/notifications',roles: ['STORE_OWNER', 'MANAGER', 'CASHIER', 'SUPER_ADMIN'] },
  { label: 'Staff',               icon: 'manage_accounts',  route: '/vendor/staff',        roles: ['STORE_OWNER', 'SUPER_ADMIN'] },
  { label: 'Facturación y Legal', icon: 'receipt',          route: '/vendor/legal',        roles: ['STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'] },
  { label: 'Plan y Suscripción',  icon: 'credit_card',      route: '/vendor/subscription', roles: ['STORE_OWNER', 'SUPER_ADMIN'] },
  { label: 'Repartidores',        icon: 'person_pin',       route: '/vendor/riders',       roles: ['SUPER_ADMIN'] },
];

@Component({
  selector: 'td-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, BadgeComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  userRole = input.required<Role>();
  collapsed = input<boolean>(false);
  notificationCount = input<number>(0);

  itemClick = output<string>();

  visibleItems = computed(() => {
    const role = this.userRole();
    return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
      ...item,
      badge: item.route === '/vendor/notifications' ? this.notificationCount() : item.badge,
    }));
  });
}
