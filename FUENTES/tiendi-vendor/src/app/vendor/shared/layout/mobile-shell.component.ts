import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TopbarComponent } from './topbar.component';
import { BottomNavComponent } from './bottom-nav.component';
import { DrawerComponent } from '../ui/organisms/drawer.component';
import { SidebarComponent } from './sidebar.component';
import { AuthStore } from '../../core/services/auth.store';
import { NotificationsStore } from '../../features/notifications/notifications.store';

@Component({
  selector: 'td-mobile-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopbarComponent, BottomNavComponent, DrawerComponent, SidebarComponent],
  template: `
    <div class="mobile-shell">
        <td-topbar
          [storeName]="storeName()"
          [unreadNotifications]="unreadCount()"
          (menuToggle)="moreDrawerOpen.set(true)"
        (notificationClick)="onNotifications()"
        (profileClick)="onProfile()"
        (logoutClick)="onLogout()"
      />

      <main class="mobile-shell__content" id="main-content" tabindex="-1">
        <router-outlet />
      </main>

      <td-bottom-nav
        [userRole]="userRole()"
        [pendingOrders]="0"
        [unreadNotifications]="unreadCount()"
        (moreClick)="moreDrawerOpen.set(true)"
      />

      <!-- More Drawer -->
      <td-drawer
        title="Menú"
        position="left"
        [visible]="moreDrawerOpen()"
        (closed)="moreDrawerOpen.set(false)"
      >
        <td-sidebar
          [userRole]="userRole()"
          [collapsed]="false"
          (itemClick)="onDrawerNavItem($event)"
          style="height: 100%; width: 100%"
        />
      </td-drawer>
    </div>
  `,
  styles: [`
    .mobile-shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .mobile-shell__content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: var(--surface);

      &:focus { outline: none; }
    }
  `],
})
export class MobileShellComponent {
  private readonly authStore = inject(AuthStore);
  private readonly notificationsStore = inject(NotificationsStore);
  private readonly router = inject(Router);

  moreDrawerOpen = signal(false);

  userRole = computed(() => this.authStore.currentUser()?.role ?? 'CASHIER');
  storeName = computed(() => this.authStore.currentUser()?.name ?? 'Mi Tienda');
  unreadCount = this.notificationsStore.unreadCount;

  onDrawerNavItem(route: string): void {
    this.moreDrawerOpen.set(false);
    void this.router.navigate([route]);
  }

  onNotifications(): void {
    void this.router.navigate(['/vendor/notifications']);
  }

  onProfile(): void {
    void this.router.navigate(['/vendor/profile']);
  }

  onLogout(): void {
    this.authStore.logout();
  }
}
