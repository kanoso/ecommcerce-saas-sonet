import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { AvatarComponent } from '../ui/atoms/avatar.component';
import { BadgeComponent } from '../ui/atoms/badge.component';

@Component({
  selector: 'td-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, BadgeComponent],
  template: `
    <header class="topbar" role="banner">
      <!-- Logo + Store Name -->
      <div class="topbar__brand">
        <a routerLink="/vendor/dashboard" class="topbar__logo" aria-label="Ir al dashboard">
          <span class="topbar__logo-icon" aria-hidden="true">🛍️</span>
          <span class="topbar__logo-text">Tiendi</span>
        </a>
        @if (storeName()) {
          <span class="topbar__store-name" aria-label="Tienda: {{ storeName() }}">
            {{ storeName() }}
          </span>
        }
      </div>

      <!-- Actions -->
      <div class="topbar__actions">
        <!-- Notifications -->
        <button
          type="button"
          class="topbar__action-btn"
          aria-label="Notificaciones{{ unreadNotifications() > 0 ? ', ' + unreadNotifications() + ' sin leer' : '' }}"
          (click)="notificationClick.emit()"
        >
          <span class="material-icons-outlined" aria-hidden="true">notifications</span>
          @if (unreadNotifications() > 0) {
            <td-badge
              [count]="unreadNotifications()"
              variant="danger"
              class="topbar__badge"
            />
          }
        </button>

        <!-- Menu toggle (mobile) -->
        <button
          type="button"
          class="topbar__menu-btn topbar__menu-btn--mobile"
          aria-label="Abrir menú"
          aria-expanded="false"
          (click)="menuToggle.emit()"
        >
          <span class="material-icons-outlined" aria-hidden="true">menu</span>
        </button>

        <!-- Profile dropdown -->
        <div class="topbar__profile">
          <button
            type="button"
            class="topbar__profile-btn"
            [attr.aria-expanded]="dropdownOpen()"
            aria-haspopup="menu"
            aria-label="Menú de perfil"
            (click)="toggleDropdown()"
          >
            <td-avatar
              [name]="userName() || 'Usuario'"
              size="sm"
              [ariaLabel]="null"
            />
            <span class="material-icons-outlined topbar__chevron" aria-hidden="true">
              {{ dropdownOpen() ? 'expand_less' : 'expand_more' }}
            </span>
          </button>

          @if (dropdownOpen()) {
            <div
              class="topbar__dropdown"
              role="menu"
              aria-label="Opciones de perfil"
              (mouseleave)="dropdownOpen.set(false)"
            >
              <div class="topbar__user-header">
                <p class="topbar__user-name">{{ userName() }}</p>
                <p class="topbar__user-email">{{ userEmail() }}</p>
                @if (userRole()) {
                  <span class="topbar__user-role">{{ userRole() }}</span>
                }
              </div>
              <hr class="topbar__divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                class="topbar__dropdown-item"
                (click)="profileClick.emit(); dropdownOpen.set(false)"
              >
                <span class="material-icons-outlined" aria-hidden="true">person</span>
                Mi perfil
              </button>
              <hr class="topbar__divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                class="topbar__dropdown-item topbar__dropdown-item--danger"
                (click)="logoutClick.emit(); dropdownOpen.set(false)"
              >
                <span class="material-icons-outlined" aria-hidden="true">logout</span>
                Cerrar sesión
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      height: var(--topbar-height);
      background: var(--card);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: var(--shadow);
    }

    .topbar__brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .topbar__logo {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: var(--text-primary);

      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; border-radius: 4px; }
    }

    .topbar__logo-icon { font-size: 20px; }

    .topbar__logo-text {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
    }

    .topbar__store-name {
      font-size: 14px;
      color: var(--text-secondary);
      padding-left: 12px;
      border-left: 1px solid var(--border);

      /* Hide on mobile */
      @media (max-width: 767px) { display: none; }
    }

    .topbar__actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .topbar__action-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border: none;
      background: transparent;
      border-radius: var(--radius);
      cursor: pointer;
      color: var(--text-secondary);
      transition: background 0.15s, color 0.15s;

      &:hover { background: var(--surface); color: var(--text-primary); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }

      span { font-size: 22px; }
    }

    .topbar__badge {
      position: absolute;
      top: 4px;
      right: 4px;
    }

    .topbar__menu-btn {
      display: none;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border: none;
      background: transparent;
      border-radius: var(--radius);
      cursor: pointer;
      color: var(--text-secondary);

      &:hover { background: var(--surface); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }

      span { font-size: 22px; }

      @media (max-width: 767px) { display: flex; }
    }

    .topbar__profile {
      position: relative;
    }

    .topbar__profile-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      border: none;
      background: transparent;
      padding: 6px 8px;
      border-radius: var(--radius);
      cursor: pointer;
      min-height: 44px;

      &:hover { background: var(--surface); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }
    }

    .topbar__chevron {
      font-size: 18px;
      color: var(--text-secondary);
      @media (max-width: 767px) { display: none; }
    }

    .topbar__dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      min-width: 180px;
      z-index: 200;
      padding: 6px 0;
      animation: dropdown-in 0.1s ease;
    }

    .topbar__user-header {
      padding: 12px 16px 10px;
    }

    .topbar__user-name {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .topbar__user-email {
      margin: 2px 0 6px;
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .topbar__user-role {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      background: var(--primary-light);
      color: var(--primary);
    }

    .topbar__dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: transparent;
      font-size: 14px;
      font-family: inherit;
      color: var(--text-primary);
      cursor: pointer;
      text-align: left;
      min-height: 44px;

      &:hover { background: var(--surface); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: -2px; }

      span { font-size: 18px; color: var(--text-secondary); }
    }

    .topbar__dropdown-item--danger {
      color: var(--danger);
      span { color: var(--danger); }
      &:hover { background: var(--danger-light); }
    }

    .topbar__divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 4px 0;
    }

    @keyframes dropdown-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .topbar__dropdown { animation: none; }
    }
  `],
})
export class TopbarComponent {
  storeName = input<string>('');
  userName = input<string>('');
  userEmail = input<string>('');
  userRole = input<string>('');
  unreadNotifications = input<number>(0);

  menuToggle = output<void>();
  notificationClick = output<void>();
  profileClick = output<void>();
  logoutClick = output<void>();

  dropdownOpen = signal(false);

  toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
  }
}
