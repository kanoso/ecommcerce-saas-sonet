import {
  ChangeDetectionStrategy, Component, inject, OnInit,
} from '@angular/core';

import { LegalStore } from '../legal.store';
import { InvoicesTabComponent } from '../components/invoices-tab.component';
import { SunatConfigTabComponent, SunatConfigValue } from '../components/sunat-config-tab.component';
import { ComplaintsTabComponent } from '../components/complaints-tab.component';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InvoicesTabComponent,
    SunatConfigTabComponent,
    ComplaintsTabComponent,
  ],
  template: `
    <div class="legal-page">

      <!-- Warning Banner SUNAT -->
      @if (!store.sunatConfigured()) {
        <div class="warning-banner" role="alert">
          <span class="material-icons-outlined warning-banner__icon">warning_amber</span>
          <span class="warning-banner__text">
            <strong>Configuración SUNAT pendiente</strong> — No podés emitir comprobantes electrónicos hasta completar la configuración.
          </span>
          <button class="warning-banner__link" (click)="store.setTab('sunat')">
            Configurar ahora →
          </button>
        </div>
      }

      <!-- Page Header -->
      <div class="page-header">
        <h1 class="page-header__title">Facturación y Legal</h1>
        <p class="page-header__sub">Gestioná tus comprobantes, configuración SUNAT y libro de reclamaciones.</p>
      </div>

      <!-- Tabs -->
      <div class="tabs" role="tablist">
        <button
          class="tab-btn"
          [class.tab-btn--active]="store.activeTab() === 'invoices'"
          role="tab"
          [attr.aria-selected]="store.activeTab() === 'invoices'"
          (click)="store.setTab('invoices')"
        >
          <span class="material-icons-outlined tab-btn__icon">receipt_long</span>
          Comprobantes
          @if (store.invoices().length > 0) {
            <span class="tab-badge">{{ store.invoices().length }}</span>
          }
        </button>

        <button
          class="tab-btn"
          [class.tab-btn--active]="store.activeTab() === 'sunat'"
          role="tab"
          [attr.aria-selected]="store.activeTab() === 'sunat'"
          (click)="store.setTab('sunat')"
        >
          <span class="material-icons-outlined tab-btn__icon">settings</span>
          Configuración SUNAT
          @if (!store.sunatConfigured()) {
            <span class="tab-badge tab-badge--warn">!</span>
          }
        </button>

        <button
          class="tab-btn"
          [class.tab-btn--active]="store.activeTab() === 'complaints'"
          role="tab"
          [attr.aria-selected]="store.activeTab() === 'complaints'"
          (click)="store.setTab('complaints')"
        >
          <span class="material-icons-outlined tab-btn__icon">assignment</span>
          Libro de Reclamaciones
          @if (store.pendingComplaints().length > 0) {
            <span class="tab-badge tab-badge--warn">{{ store.pendingComplaints().length }}</span>
          }
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content" role="tabpanel">

        @if (store.isLoading()) {
          <div class="loading">
            <span class="material-icons-outlined loading__icon">hourglass_empty</span>
            Cargando...
          </div>
        } @else {

          @switch (store.activeTab()) {

            @case ('invoices') {
              <app-invoices-tab
                [invoices]="store.filteredInvoices()"
                [filters]="store.invoiceFilters()"
                (filtersChange)="store.setInvoiceFilters($event)"
                (export)="onExport()"
              />
            }

            @case ('sunat') {
              <app-sunat-config-tab
                [isSaving]="store.isSaving()"
                [initialConfig]="sunatInitialConfig()"
                (save)="onSaveSunat($event)"
                (cancelled)="store.setTab('invoices')"
              />
            }

            @case ('complaints') {
              <app-complaints-tab
                [complaints]="store.complaints()"
                (respond)="store.respondComplaint($event.id, $event.response)"
                (saveDraft)="store.saveDraft($event.id, $event.draft)"
              />
            }

          }
        }

      </div>

      <!-- Error banner -->
      @if (store.error()) {
        <div class="error-banner" role="alert">
          <span class="material-icons-outlined" style="font-size:16px">error_outline</span>
          {{ store.error() }}
        </div>
      }

    </div>

    <!-- Toast -->
    @if (store.successMessage()) {
      <div class="toast" role="status" aria-live="polite">
        <span class="material-icons-outlined" style="font-size:18px">check_circle</span>
        {{ store.successMessage() }}
      </div>
    }
  `,
  styles: [`
    .legal-page {
      padding: 24px; max-width: 1280px; margin: 0 auto;
      display: flex; flex-direction: column; gap: 20px;
    }

    /* Warning banner */
    .warning-banner {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius);
      padding: 12px 16px; font-size: 13px; color: #92400E;
    }
    .warning-banner__icon { font-size: 18px; color: var(--warning); flex-shrink: 0; }
    .warning-banner__text { flex: 1; }
    .warning-banner__link {
      background: none; border: none; cursor: pointer; font-size: 13px;
      font-weight: 600; color: #92400E; text-decoration: underline; padding: 0;
      white-space: nowrap;
    }
    .warning-banner__link:hover { color: #78350F; }

    /* Page header */
    .page-header { }
    .page-header__title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    .page-header__sub { font-size: 14px; color: var(--text-muted); margin: 0; }

    /* Tabs */
    .tabs {
      display: flex; gap: 0; border-bottom: 2px solid var(--border);
      overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    .tab-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 20px; border: none; background: transparent; cursor: pointer;
      font-size: 14px; font-weight: 500; color: var(--text-muted);
      border-bottom: 2px solid transparent; margin-bottom: -2px;
      transition: color .15s, border-color .15s; white-space: nowrap;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn--active { color: var(--primary); border-bottom-color: var(--primary); }
    .tab-btn__icon { font-size: 16px; }

    .tab-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; padding: 0 5px;
      background: #E5E7EB; color: #374151; border-radius: 99px;
      font-size: 11px; font-weight: 600;
    }
    .tab-badge--warn { background: #FEF3C7; color: #92400E; }

    /* Tab content */
    .tab-content {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 24px;
    }

    /* Loading */
    .loading {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 64px 24px; color: var(--text-muted); font-size: 14px;
    }
    .loading__icon { font-size: 24px; animation: spin 1.4s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Error */
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #FEF2F2; border: 1px solid #FECACA; border-radius: var(--radius);
      padding: 12px 16px; font-size: 13px; color: var(--danger);
    }

    /* Toast */
    .toast {
      position: fixed; bottom: 24px; right: 24px; background: var(--primary);
      color: #fff; padding: 12px 20px; border-radius: var(--radius);
      font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,.15); z-index: 999;
      animation: slideIn .2s ease;
    }
    @keyframes slideIn {
      from { transform: translateY(12px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    @media (max-width: 640px) {
      .legal-page { padding: 16px; }
      .tab-content { padding: 16px; }
      .tab-btn { padding: 10px 14px; font-size: 13px; }
    }
  `],
})
export class LegalPage implements OnInit {
  protected readonly store = inject(LegalStore);

  ngOnInit(): void {
    this.store.loadAll();
  }

  /** Builds initialConfig from store state for the SUNAT form */
  sunatInitialConfig(): Partial<SunatConfigValue> {
    // In a real app we'd have the full store config in state.
    // For now we return an empty object — the form uses its own defaults.
    return {};
  }

  onExport(): void {
    // Mock: would trigger CSV/PDF export from the backend
    alert('Exportando comprobantes...');
  }

  onSaveSunat(config: SunatConfigValue): void {
    this.store.saveSunatConfig(config);
  }
}
