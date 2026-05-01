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
  template: `
    <div class="store-config">
      <div class="store-config__header">
        <div>
          <h1 class="store-config__title">Mi Tienda</h1>
          <p class="store-config__subtitle">Configuración y datos de tu tienda</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="store-config__tabs">
        @for (tab of tabs; track tab.id) {
          <button
            class="store-config__tab"
            [class.store-config__tab--active]="activeTab() === tab.id"
            (click)="activeTab.set(tab.id)"
          >{{ tab.label }}</button>
        }
      </div>

      <!-- Tab content -->
      <div class="store-config__content">
        @if (store.isLoading()) {
          <div class="store-config__loading">Cargando datos de la tienda...</div>
        } @else {
          @switch (activeTab()) {
            @case ('info') {
              <app-store-info-tab
                [info]="store.info()"
                [isSaving]="store.isSaving()"
                (save)="onSaveInfo($event)"
                (toggleOpen)="store.toggleStoreOpen()"
              />
            }
            @case ('schedule') {
              <app-store-schedule-tab
                [schedule]="store.schedule()"
                [isSaving]="store.isSaving()"
                (save)="onSaveSchedule($event)"
              />
            }
            @case ('delivery') {
              <app-store-delivery-tab
                [delivery]="store.delivery()"
                [isSaving]="store.isSaving()"
                (save)="onSaveDelivery($event)"
              />
            }
            @case ('payments') {
              <app-store-payments-tab
                [payments]="store.payments()"
                [isSaving]="store.isSaving()"
                (save)="onSavePayments($event)"
              />
            }
            @case ('invoicing') {
              <app-store-invoicing-tab
                [invoicing]="store.invoicing()"
                [isSaving]="store.isSaving()"
                (save)="onSaveInvoicing($event)"
              />
            }
            @case ('appearance') {
              <app-store-appearance-tab
                [appearance]="store.appearance()"
                [storeName]="store.info().name"
                [isSaving]="store.isSaving()"
                (save)="onSaveAppearance($event)"
              />
            }
          }
        }

        @if (store.error()) {
          <div class="store-config__error" role="alert">{{ store.error() }}</div>
        }
      </div>
    </div>

    <!-- Toast -->
    @if (store.successMessage()) {
      <div class="store-config__toast" role="status">
        <span class="material-icons-outlined" style="font-size:18px">check_circle</span>
        {{ store.successMessage() }}
      </div>
    }
  `,
  styles: [`
    .store-config {
      padding: 24px;
      max-width: 1280px;
      margin: 0 auto;
    }

    .store-config__header {
      margin-bottom: 24px;
    }

    .store-config__title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 4px;
    }

    .store-config__subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin: 0;
    }

    .store-config__tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
      gap: 0;
      overflow-x: auto;
    }

    .store-config__tab {
      padding: 12px 20px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-muted);
      border-bottom: 2px solid transparent;
      white-space: nowrap;
      transition: color 0.15s, border-color 0.15s;

      &:hover { color: var(--text); }
    }

    .store-config__tab--active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    .store-config__content {
      position: relative;
    }

    .store-config__loading {
      text-align: center;
      padding: 48px;
      color: var(--text-muted);
      font-size: 14px;
    }

    .store-config__error {
      margin-top: 16px;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      border-radius: var(--radius);
      padding: 12px 16px;
      font-size: 13px;
      color: var(--danger);
    }

    .store-config__toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--primary);
      color: #fff;
      padding: 12px 20px;
      border-radius: var(--radius);
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999;
      animation: slideIn 0.2s ease;
    }

    @keyframes slideIn {
      from { transform: translateY(12px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    @media (max-width: 640px) {
      .store-config { padding: 16px; }
    }
  `],
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
