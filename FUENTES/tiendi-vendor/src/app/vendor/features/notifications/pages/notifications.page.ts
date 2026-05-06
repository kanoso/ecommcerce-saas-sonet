import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { NotificationsStore, NotifTab, NotifSettings } from '../notifications.store';
import { NotificationListComponent } from '../components/notification-list.component';
import { NotificationSettingsCardComponent } from '../components/notification-settings-card.component';

const TABS: { id: NotifTab; label: string }[] = [
  { id: 'all',    label: 'Todas' },
  { id: 'unread', label: 'Sin leer' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'stock',  label: 'Stock' },
  { id: 'system', label: 'Sistema' },
];

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationListComponent, NotificationSettingsCardComponent],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage implements OnInit {
  protected readonly store = inject(NotificationsStore);
  protected readonly tabs = TABS;

  ngOnInit(): void { this.store.loadAll(); }

  onSaveSettings(settings: NotifSettings): void { this.store.saveSettings(settings); }
}
