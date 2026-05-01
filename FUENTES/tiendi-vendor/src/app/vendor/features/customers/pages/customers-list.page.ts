import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { CustomersStore, CustomerType } from '../customers.store';
import { CustomersKpiBarComponent } from '../components/customers-kpi-bar.component';
import { CustomersTableComponent } from '../components/customers-table.component';
import { CustomerDetailModalComponent } from '../components/customer-detail-modal.component';

/**
 * Smart container page for the Customers (CRM) feature.
 * Route: /vendor/customers
 *
 * Usage (in routing):
 * loadComponent: () =>
 *   import('./features/customers/pages/customers-list.page').then(c => c.CustomersListPage)
 */
@Component({
  selector: 'app-customers-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CustomersKpiBarComponent,
    CustomersTableComponent,
    CustomerDetailModalComponent,
  ],
  template: `
    <div class="page-wrapper">

      <!-- Page header -->
      <header class="page-header">
        <div>
          <h1 class="page-title">Clientes</h1>
          <p class="page-subtitle">Gestión y seguimiento de tu base de clientes</p>
        </div>
        <button
          class="btn-export"
          type="button"
          aria-label="Exportar lista de clientes"
          (click)="onExport()"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar
        </button>
      </header>

      <!-- KPI Bar -->
      <app-customers-kpi-bar [summary]="store.summary()" />

      <!-- Toolbar: search + type filter -->
      <div class="toolbar" role="search">
        <div class="search-wrapper">
          <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            class="search-input"
            type="search"
            placeholder="Buscar por nombre, teléfono o email…"
            aria-label="Buscar clientes"
            [value]="store.search()"
            (input)="onSearchInput($event)"
          />
        </div>

        <select
          class="filter-select"
          aria-label="Filtrar por tipo de cliente"
          [value]="store.typeFilter()"
          (change)="onTypeChange($event)"
        >
          <option value="">Todos</option>
          <option value="vip">⭐ VIP</option>
          <option value="regular">Regular</option>
          <option value="new">Nuevo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>

      <!-- Loading skeleton -->
      @if (store.isLoading()) {
        <div class="skeleton-wrapper" role="status" aria-label="Cargando clientes">
          @for (n of skeletonRows; track n) {
            <div class="skeleton-row">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-lines">
                <div class="skeleton-line skeleton-line-lg"></div>
                <div class="skeleton-line skeleton-line-sm"></div>
              </div>
              <div class="skeleton-pill"></div>
              <div class="skeleton-pill"></div>
              <div class="skeleton-btn"></div>
            </div>
          }
        </div>
      } @else {
        <!-- Customers table -->
        <app-customers-table
          [customers]="store.customers()"
          (viewDetail)="store.selectCustomer($event)"
        />

        <!-- Pagination -->
        @if (store.totalPages() > 1) {
          <nav class="pagination" aria-label="Paginación de clientes">
            <button
              class="page-btn"
              [disabled]="store.page() === 1"
              [attr.aria-disabled]="store.page() === 1"
              (click)="onPageChange(store.page() - 1)"
              aria-label="Página anterior"
              type="button"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            @for (p of getPageRange(); track p) {
              <button
                class="page-btn"
                [class.active]="p === store.page()"
                [attr.aria-current]="p === store.page() ? 'page' : null"
                (click)="onPageChange(p)"
                type="button"
              >
                {{ p }}
              </button>
            }

            <button
              class="page-btn"
              [disabled]="store.page() === store.totalPages()"
              [attr.aria-disabled]="store.page() === store.totalPages()"
              (click)="onPageChange(store.page() + 1)"
              aria-label="Página siguiente"
              type="button"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </nav>
        }
      }

      <!-- Error state -->
      @if (store.error()) {
        <div class="error-banner" role="alert">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {{ store.error() }}
        </div>
      }

      <!-- LGPD / Privacy Banner (Ley 29733 - Perú) -->
      <aside class="lgpd-banner" role="complementary" aria-label="Aviso de privacidad">
        <div class="lgpd-icon" aria-hidden="true">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <p class="lgpd-text">
          <strong>Aviso de privacidad:</strong>
          Los datos personales de tus clientes están protegidos conforme a la
          <strong>Ley N.° 29733</strong> – Ley de Protección de Datos Personales del Perú.
          Solo el titular de la tienda y usuarios autorizados pueden acceder a esta información.
        </p>
      </aside>

    </div>

    <!-- Detail Modal (rendered outside page flow via overlay) -->
    <app-customer-detail-modal
      [customer]="store.selected()"
      (closed)="store.clearSelected()"
    />
  `,
  styles: [`
    .page-wrapper {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px 48px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 4px;
    }

    .page-subtitle {
      font-size: 14px;
      color: var(--text-muted, #6B7280);
      margin: 0;
    }

    .btn-export {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      background: transparent;
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius, 8px);
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      white-space: nowrap;
      transition: border-color 0.15s, background 0.15s;
    }

    .btn-export:hover {
      border-color: var(--primary, #047857);
      color: var(--primary, #047857);
      background: #F0FDF4;
    }

    .btn-export:focus-visible {
      outline: 2px solid var(--primary, #047857);
      outline-offset: 2px;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .search-wrapper {
      position: relative;
      flex: 1;
      min-width: 200px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted, #6B7280);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 9px 12px 9px 38px;
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius, 8px);
      font-size: 14px;
      background: var(--card, #fff);
      color: #111827;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }

    .search-input::placeholder {
      color: var(--text-muted, #6B7280);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--primary, #047857);
      box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.12);
    }

    .filter-select {
      padding: 9px 12px;
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius, 8px);
      font-size: 14px;
      background: var(--card, #fff);
      color: #111827;
      cursor: pointer;
      min-width: 140px;
      transition: border-color 0.15s;
    }

    .filter-select:focus {
      outline: none;
      border-color: var(--primary, #047857);
      box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.12);
    }

    /* Skeleton */
    .skeleton-wrapper {
      background: var(--card, #fff);
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      overflow: hidden;
    }

    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border, #E5E7EB);
      animation: pulse 1.4s ease-in-out infinite;
    }

    .skeleton-row:last-child {
      border-bottom: none;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .skeleton-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #E5E7EB;
      flex-shrink: 0;
    }

    .skeleton-lines {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .skeleton-line {
      height: 12px;
      border-radius: 4px;
      background: #E5E7EB;
    }

    .skeleton-line-lg { width: 60%; }
    .skeleton-line-sm { width: 40%; }

    .skeleton-pill {
      width: 60px;
      height: 24px;
      border-radius: 20px;
      background: #E5E7EB;
    }

    .skeleton-btn {
      width: 90px;
      height: 32px;
      border-radius: var(--radius, 8px);
      background: #E5E7EB;
    }

    /* Pagination */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding-top: 4px;
    }

    .page-btn {
      min-width: 36px;
      height: 36px;
      padding: 0 10px;
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius, 8px);
      background: var(--card, #fff);
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }

    .page-btn:hover:not(:disabled):not(.active) {
      border-color: var(--primary, #047857);
      color: var(--primary, #047857);
    }

    .page-btn.active {
      background: var(--primary, #047857);
      border-color: var(--primary, #047857);
      color: #fff;
    }

    .page-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .page-btn:focus-visible {
      outline: 2px solid var(--primary, #047857);
      outline-offset: 2px;
    }

    /* Error */
    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: var(--radius, 8px);
      color: #B91C1C;
      font-size: 14px;
    }

    /* LGPD Banner */
    .lgpd-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: var(--radius, 8px);
    }

    .lgpd-icon {
      color: #2563EB;
      margin-top: 1px;
      flex-shrink: 0;
    }

    .lgpd-text {
      font-size: 13px;
      color: #1E40AF;
      margin: 0;
      line-height: 1.5;
    }

    @media (max-width: 640px) {
      .page-header {
        flex-direction: column;
      }

      .toolbar {
        flex-direction: column;
      }

      .filter-select {
        width: 100%;
      }
    }
  `],
})
export class CustomersListPage implements OnInit, OnDestroy {
  protected readonly store = inject(CustomersStore);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Load data in parallel on init
    this.store.loadCustomers();
    this.store.loadSummary();

    // Debounced search — 400ms, only emit on actual change
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(async (query) => {
      await this.store.setSearch(query);
      this.store.loadCustomers();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  async onTypeChange(event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value as CustomerType | '';
    await this.store.setTypeFilter(value);
    this.store.loadCustomers();
  }

  async onPageChange(page: number): Promise<void> {
    await this.store.setPage(page);
    this.store.loadCustomers();
  }

  getPageRange(): number[] {
    const total = this.store.totalPages();
    const current = this.store.page();
    const delta = 2;
    const pages: number[] = [];

    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  onExport(): void {
    // Export placeholder — connect to backend or CSV generation
    console.log('[CustomersListPage] Export requested');
  }
}
