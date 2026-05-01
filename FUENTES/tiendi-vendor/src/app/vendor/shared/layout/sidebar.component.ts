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
  { label: 'Dashboard',         icon: 'dashboard',        route: '/vendor/dashboard',    roles: ['STORE_OWNER', 'MANAGER', 'CASHIER'] },
  { label: 'Pedidos',           icon: 'receipt_long',     route: '/vendor/orders',       roles: ['STORE_OWNER', 'MANAGER', 'CASHIER'] },
  { label: 'Productos',         icon: 'inventory_2',      route: '/vendor/products',     roles: ['STORE_OWNER', 'MANAGER', 'WAREHOUSE'] },
  { label: 'Mi Tienda',         icon: 'store',            route: '/vendor/store',        roles: ['STORE_OWNER', 'MANAGER'] },
  { label: 'Analytics',         icon: 'bar_chart',        route: '/vendor/analytics',    roles: ['STORE_OWNER', 'MANAGER'] },
  { label: 'Clientes',          icon: 'group',            route: '/vendor/customers',    roles: ['STORE_OWNER', 'MANAGER'] },
  { label: 'Notificaciones',    icon: 'notifications',    route: '/vendor/notifications',roles: ['STORE_OWNER', 'MANAGER', 'CASHIER'] },
  { label: 'Staff',             icon: 'manage_accounts',  route: '/vendor/staff',        roles: ['STORE_OWNER'] },
  { label: 'Facturación y Legal', icon: 'receipt',        route: '/vendor/legal',        roles: ['STORE_OWNER', 'MANAGER'] },
  { label: 'Plan y Suscripción',  icon: 'credit_card',    route: '/vendor/subscription', roles: ['STORE_OWNER'] },
];

@Component({
  selector: 'td-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, BadgeComponent],
  template: `
    <nav
      class="sidebar"
      [class.sidebar--collapsed]="collapsed()"
      role="navigation"
      aria-label="Menú principal"
    >
      <ul class="sidebar__nav" role="list">
        @for (item of visibleItems(); track item.route) {
          <li role="listitem">
            <a
              [routerLink]="item.route"
              routerLinkActive="sidebar__link--active"
              [routerLinkActiveOptions]="{ exact: item.route === '/vendor/dashboard' }"
              class="sidebar__link"
              [class.sidebar__link--collapsed]="collapsed()"
              [attr.aria-label]="collapsed() ? item.label : null"
              [attr.title]="collapsed() ? item.label : null"
              (click)="itemClick.emit(item.route)"
            >
              <span
                class="material-icons-outlined sidebar__icon"
                aria-hidden="true"
              >{{ item.icon }}</span>

              @if (!collapsed()) {
                <span class="sidebar__label">{{ item.label }}</span>
              }

              @if (item.badge && item.badge > 0) {
                <td-badge
                  [count]="item.badge"
                  variant="danger"
                  class="sidebar__badge"
                />
              }
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: [`
    .sidebar {
      width: var(--sidebar-width);
      background: var(--sidebar-bg);
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      transition: width 0.25s ease;
      flex-shrink: 0;
    }

    .sidebar--collapsed {
      width: 64px;
    }

    .sidebar__nav {
      list-style: none;
      margin: 0;
      padding: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sidebar__link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      margin: 0 8px;
      border-radius: var(--radius);
      text-decoration: none;
      color: #9CA3AF;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      position: relative;
      min-height: 44px;
      white-space: nowrap;

      &:hover {
        background: rgba(255,255,255,0.08);
        color: #F9FAFB;
      }

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
      }
    }

    .sidebar__link--active {
      background: rgba(4, 120, 87, 0.15) !important;
      color: #10B981 !important;
    }

    .sidebar__link--collapsed {
      padding: 10px;
      justify-content: center;
      gap: 0;
      margin: 0 8px;
    }

    .sidebar__icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .sidebar__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sidebar__badge {
      margin-left: auto;
    }

    /* Tablet: collapse to icon-only */
    @media (min-width: 768px) and (max-width: 1023px) {
      .sidebar {
        width: 64px;
      }
      .sidebar__label { display: none; }
      .sidebar__link { justify-content: center; gap: 0; padding: 10px; }
      .sidebar__badge { position: absolute; top: 4px; right: 4px; }
    }
  `],
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
