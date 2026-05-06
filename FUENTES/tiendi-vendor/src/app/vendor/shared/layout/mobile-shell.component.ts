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
  private readonly router = inject(Router);

  moreDrawerOpen = signal(false);

  userRole = computed(() => this.authStore.currentUser()?.role ?? 'CASHIER');
  storeName = computed(() => this.authStore.currentUser()?.name ?? 'Mi Tienda');

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
