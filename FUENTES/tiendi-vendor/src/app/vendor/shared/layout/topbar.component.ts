import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../ui/atoms/avatar.component';
import { BadgeComponent } from '../ui/atoms/badge.component';

@Component({
  selector: 'td-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent, BadgeComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
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
