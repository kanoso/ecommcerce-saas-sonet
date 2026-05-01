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
  template: `
    <nav
      class="bottom-nav"
      role="navigation"
      aria-label="Navegación principal"
    >
      @for (item of visibleItems(); track item.route) {
        <a
          [routerLink]="item.route"
          routerLinkActive="bottom-nav__item--active"
          class="bottom-nav__item"
          [attr.aria-label]="item.label + badgeAriaLabel(item)"
        >
          <div class="bottom-nav__icon-wrap">
            <span class="material-icons-outlined" aria-hidden="true">{{ item.icon }}</span>
            @if (item.badge === 'orders' && pendingOrders() > 0) {
              <td-badge [count]="pendingOrders()" variant="danger" class="bottom-nav__badge" />
            }
            @if (item.badge === 'notifications' && unreadNotifications() > 0) {
              <td-badge [count]="unreadNotifications()" variant="danger" class="bottom-nav__badge" />
            }
          </div>
          <span class="bottom-nav__label">{{ item.label }}</span>
        </a>
      }

      <!-- Más -->
      <button
        type="button"
        class="bottom-nav__item bottom-nav__item--more"
        aria-label="Ver más opciones"
        (click)="moreClick.emit()"
      >
        <div class="bottom-nav__icon-wrap">
          <span class="material-icons-outlined" aria-hidden="true">more_horiz</span>
        </div>
        <span class="bottom-nav__label">Más</span>
      </button>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      display: flex;
      align-items: stretch;
      background: var(--card);
      border-top: 1px solid var(--border);
      height: 64px;
      position: sticky;
      bottom: 0;
      z-index: 100;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .bottom-nav__item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 10px;
      font-weight: 500;
      padding: 8px 4px;
      border: none;
      background: transparent;
      font-family: inherit;
      cursor: pointer;
      min-width: 44px;
      transition: color 0.15s;

      &:hover { color: var(--primary); }

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
      }
    }

    .bottom-nav__item--active {
      color: var(--primary) !important;
    }

    .bottom-nav__icon-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      span { font-size: 22px; }
    }

    .bottom-nav__badge {
      position: absolute;
      top: -4px;
      right: -6px;
    }

    .bottom-nav__label {
      font-size: 10px;
      line-height: 1;
    }
  `],
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
