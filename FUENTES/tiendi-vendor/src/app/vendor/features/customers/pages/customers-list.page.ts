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
  templateUrl: './customers-list.page.html',
  styleUrl: './customers-list.page.scss',
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
