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

interface BottomNavItem {
  label: string;
  icon: string;
  route: string;
  badge?: 'orders' | 'notifications';
}

const BOTTOM_ITEMS: BottomNavItem[] = [
  { label: 'Dashboard',       icon: 'dashboard',      route: '/vendor/dashboard' },
  { label: 'Pedidos',         icon: 'shopping_cart',  route: '/vendor/orders',        badge: 'orders' },
  { label: 'Productos',       icon: 'inventory_2',    route: '/vendor/products' },
  { label: 'Notificaciones',  icon: 'notifications',  route: '/vendor/notifications', badge: 'notifications' },
];

@Component({
  selector: 'td-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, BadgeComponent],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  userRole = input.required<Role>();
  pendingOrders = input<number>(0);
  unreadNotifications = input<number>(0);

  moreClick = output<void>();

  visibleItems = computed(() => {
    const role = this.userRole();
    return BOTTOM_ITEMS.filter((item) => {
      if (item.route === '/vendor/products') {
        return ['STORE_OWNER', 'MANAGER', 'WAREHOUSE'].includes(role);
      }
      if (item.route === '/vendor/dashboard') {
        return ['STORE_OWNER', 'MANAGER', 'CASHIER'].includes(role);
      }
      return true;
    });
  });

  badgeAriaLabel(item: BottomNavItem): string {
    if (item.badge === 'orders' && this.pendingOrders() > 0) {
      return `, ${this.pendingOrders()} pedidos pendientes`;
    }
    if (item.badge === 'notifications' && this.unreadNotifications() > 0) {
      return `, ${this.unreadNotifications()} notificaciones sin leer`;
    }
    return '';
  }
}
