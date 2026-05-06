import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TopbarComponent } from './topbar.component';
import { SidebarComponent } from './sidebar.component';
import { MobileShellComponent } from './mobile-shell.component';
import { AuthStore } from '../../core/services/auth.store';
import { StoreConfigStore } from '../../features/store-config/store-config.store';
import { NotificationsStore } from '../../features/notifications/notifications.store';

const ROLE_LABELS: Record<string, string> = {
  STORE_OWNER: 'Dueño',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero/a',
  WAREHOUSE: 'Depósito',
};

@Component({
  selector: 'td-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopbarComponent, SidebarComponent, MobileShellComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly authStore = inject(AuthStore);
  private readonly storeConfigStore = inject(StoreConfigStore);
  private readonly notificationsStore = inject(NotificationsStore);
  private readonly router = inject(Router);

  private readonly isMobile$ = this.breakpointObserver
    .observe([Breakpoints.Handset])
    .pipe(map((result) => result.matches));

  private readonly isTablet$ = this.breakpointObserver
    .observe(['(min-width: 768px) and (max-width: 1023px)'])
    .pipe(map((result) => result.matches));

  isMobile = toSignal(this.isMobile$, { initialValue: false });
  isTablet = toSignal(this.isTablet$, { initialValue: false });

  userRole = computed(() => this.authStore.currentUser()?.role ?? 'CASHIER');
  storeName = computed(() => this.storeConfigStore.info().name || 'Mi Tienda');
  userName = computed(() => this.authStore.currentUser()?.name ?? '');
  userEmail = computed(() => this.authStore.currentUser()?.email ?? '');
  userRoleLabel = computed(() => ROLE_LABELS[this.userRole()] ?? this.userRole());
  unreadCount = this.notificationsStore.unreadCount;

  ngOnInit(): void {
    this.authStore.loadFromStorage();
    this.authStore.fetchMe();
    this.storeConfigStore.loadStore();
    this.notificationsStore.loadAll();
  }

  onMenuToggle(): void {
    // Handled by responsive layout via breakpoints
  }

  onNavItem(route: string): void {
    void this.router.navigate([route]);
  }

  onNotifications(): void {
    void this.router.navigate(['/vendor/notifications']);
  }

  onProfile(): void {
    void this.router.navigate(['/vendor/store']);
  }

  onLogout(): void {
    this.authStore.logout();
  }
}
