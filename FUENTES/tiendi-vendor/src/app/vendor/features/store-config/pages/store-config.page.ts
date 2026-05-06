import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { StoreConfigStore, StoreInfo, StoreScheduleDay, StoreDelivery, StorePayments, StoreInvoicing, StoreAppearance } from '../store-config.store';
import { StoreInfoTabComponent } from '../components/store-info-tab.component';
import { StoreScheduleTabComponent } from '../components/store-schedule-tab.component';
import { StoreDeliveryTabComponent } from '../components/store-delivery-tab.component';
import { StorePaymentsTabComponent } from '../components/store-payments-tab.component';
import { StoreInvoicingTabComponent } from '../components/store-invoicing-tab.component';
import { StoreAppearanceTabComponent } from '../components/store-appearance-tab.component';

type Tab = 'info' | 'schedule' | 'delivery' | 'payments' | 'invoicing' | 'appearance';

const TABS: { id: Tab; label: string }[] = [
  { id: 'info',       label: 'Información' },
  { id: 'schedule',   label: 'Horarios' },
  { id: 'delivery',   label: 'Delivery' },
  { id: 'payments',   label: 'Pagos' },
  { id: 'invoicing',  label: 'Facturación 🧾' },
  { id: 'appearance', label: 'Apariencia' },
];

@Component({
  selector: 'app-store-config-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StoreInfoTabComponent,
    StoreScheduleTabComponent,
    StoreDeliveryTabComponent,
    StorePaymentsTabComponent,
    StoreInvoicingTabComponent,
    StoreAppearanceTabComponent,
  ],
  templateUrl: './store-config.page.html',
  styleUrl: './store-config.page.scss',
})
export class StoreConfigPage implements OnInit {
  protected readonly store = inject(StoreConfigStore);
  protected readonly tabs = TABS;
  protected readonly activeTab = signal<Tab>('info');

  ngOnInit(): void {
    this.store.loadStore();
  }

  onSaveInfo(info: StoreInfo): void        { this.store.saveInfo(info); }
  onSaveSchedule(s: StoreScheduleDay[]): void { this.store.saveSchedule(s); }
  onSaveDelivery(d: StoreDelivery): void   { this.store.saveDelivery(d); }
  onSavePayments(p: StorePayments): void   { this.store.savePayments(p); }
  onSaveInvoicing(i: StoreInvoicing): void { this.store.saveInvoicing(i); }
  onSaveAppearance(a: StoreAppearance): void { this.store.saveAppearance(a); }
}
