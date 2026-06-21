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
import type { Role } from '../../core/types';
import { NotificationsStore } from '../../features/notifications/notifications.store';

@Component({
  selector: 'td-mobile-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopbarComponent, BottomNavComponent, DrawerComponent, SidebarComponent],
  templateUrl: './mobile-shell.component.html',
  styleUrl: './mobile-shell.component.scss',
})
export class MobileShellComponent {
  private readonly authStore = inject(AuthStore);
  private readonly notificationsStore = inject(NotificationsStore);
  private readonly router = inject(Router);

  moreDrawerOpen = signal(false);

  userRole = computed(() => {
    const u = this.authStore.currentUser();
    if (!u) return 'CASHIER' as const;
    return (u.role === 'EMPLOYEE' && u.storeRole ? u.storeRole : u.role) as Role;
  });
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
