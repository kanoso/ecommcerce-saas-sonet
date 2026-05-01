import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProductsStore } from '../products.store';
import { ProductToolbarComponent } from '../components/product-toolbar.component';
import { PlanUsageBarComponent } from '../components/plan-usage-bar.component';
import { ProductGridComponent } from '../components/product-grid.component';
import { ProductListTableComponent } from '../components/product-list-table.component';
import { ProductCategoriesComponent } from '../components/product-categories.component';

type Tab = 'products' | 'categories';

@Component({
  selector: 'td-product-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ProductToolbarComponent,
    PlanUsageBarComponent,
    ProductGridComponent,
    ProductListTableComponent,
    ProductCategoriesComponent,
  ],
  template: `
    <div class="page">

      <!-- Header con tabs -->
      <div class="page__header">
        <div class="page__tabs" role="tablist" aria-label="Secciones de productos">
          <button
            class="page__tab"
            [class.page__tab--active]="activeTab() === 'products'"
            (click)="activeTab.set('products')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'products'"
            id="tab-products"
            aria-controls="panel-products"
          >
            <span class="material-icons-outlined" aria-hidden="true">inventory_2</span>
            Productos
            @if (store.activeCount() > 0) {
              <span class="page__tab-badge" aria-label="{{ store.activeCount() }} productos activos">
                {{ store.activeCount() }}
              </span>
            }
          </button>
          <button
            class="page__tab"
            [class.page__tab--active]="activeTab() === 'categories'"
            (click)="activeTab.set('categories')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'categories'"
            id="tab-categories"
            aria-controls="panel-categories"
          >
            <span class="material-icons-outlined" aria-hidden="true">category</span>
            Categorías
          </button>
        </div>

        @if (activeTab() === 'products') {
          <button
            class="page__new-btn"
            (click)="goNew()"
            type="button"
            aria-label="Agregar nuevo producto"
          >
            <span class="material-icons-outlined" aria-hidden="true">add</span>
            Nuevo producto
          </button>
        }
      </div>

      <!-- Panel: Productos -->
      @if (activeTab() === 'products') {
        <div id="panel-products" role="tabpanel" aria-labelledby="tab-products">

          <td-product-toolbar
            [filters]="store.filters()"
            [viewMode]="viewMode()"
            (filtersChange)="store.setFilters($event)"
            (viewModeChange)="onViewModeChange($event)"
            (newProduct)="goNew()"
            (importCsv)="goImport()"
          />

          <td-plan-usage-bar
            [used]="store.activeCount()"
            [max]="50"
          />

          @if (store.lowStockCount() > 0) {
            <div class="page__alert" role="status" aria-live="polite">
              <span class="material-icons-outlined" aria-hidden="true">warning</span>
              {{ store.lowStockCount() }} producto{{ store.lowStockCount() > 1 ? 's' : '' }} con stock bajo
            </div>
          }

          @if (store.error()) {
            <div class="page__error" role="alert">
              <span class="material-icons-outlined" aria-hidden="true">error_outline</span>
              {{ store.error() }}
            </div>
          }

          <div class="page__content">
            @if (viewMode() === 'grid') {
              <td-product-grid
                [products]="store.filteredProducts()"
                [isLoading]="store.isLoading()"
                (edit)="onEdit($event)"
                (delete)="onDelete($event)"
                (toggleActive)="onToggleActive($event)"
              />
            } @else {
              <td-product-list-table
                [products]="store.filteredProducts()"
                [isLoading]="store.isLoading()"
                (edit)="onEdit($event)"
                (delete)="onDelete($event)"
                (toggleActive)="onToggleActive($event)"
              />
            }
          </div>
        </div>
      }

      <!-- Panel: Categorías -->
      @if (activeTab() === 'categories') {
        <div id="panel-categories" role="tabpanel" aria-labelledby="tab-categories">
          <td-product-categories [categories]="store.categories()" />
        </div>
      }

    </div>
  `,
  styles: [`
    .page {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .page__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .page__tabs {
      display: flex;
      gap: 4px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 4px;
    }

    .page__tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: var(--radius);
      font-size: 14px;
      font-family: inherit;
      font-weight: 500;
      color: var(--text-secondary);
      background: transparent;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;

      .material-icons-outlined { font-size: 18px; }

      &:hover { background: var(--card); color: var(--text-primary); }

      &--active {
        background: var(--card);
        color: var(--primary);
        box-shadow: var(--shadow);
      }

      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }
    }

    .page__tab-badge {
      background: var(--primary);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      border-radius: 20px;
      padding: 1px 7px;
      min-width: 20px;
      text-align: center;
    }

    .page__new-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border: none;
      border-radius: var(--radius);
      background: var(--primary);
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;

      .material-icons-outlined { font-size: 18px; }

      &:hover { background: var(--primary-dark); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }
    }

    .page__alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      border-radius: var(--radius);
      font-size: 13px;
      color: #92400E;

      .material-icons-outlined { font-size: 18px; }
    }

    .page__error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: var(--radius);
      font-size: 13px;
      color: #991B1B;

      .material-icons-outlined { font-size: 18px; }
    }

    .page__content {
      margin-top: 4px;
    }

    @media (max-width: 640px) {
      .page { padding: 16px; }
      .page__header { flex-direction: column; align-items: stretch; }
      .page__new-btn { justify-content: center; }
    }
  `],
})
export class ProductListPage implements OnInit {
  protected store = inject(ProductsStore);
  private router = inject(Router);

  activeTab = signal<Tab>('products');
  viewMode = signal<'grid' | 'list'>('grid');

  ngOnInit(): void {
    this.store.loadProducts();
  }

  onViewModeChange(mode: string): void {
    this.viewMode.set(mode as 'grid' | 'list');
  }

  onEdit(id: string): void {
    if (id === 'new') {
      this.router.navigate(['/vendor/products/new']);
    } else {
      this.router.navigate(['/vendor/products', id, 'edit']);
    }
  }

  onDelete(id: string): void {
    this.store.deleteProduct(id);
  }

  onToggleActive(event: { id: string; isActive: boolean }): void {
    this.store.toggleActive(event.id, event.isActive);
  }

  goNew(): void {
    this.router.navigate(['/vendor/products/new']);
  }

  goImport(): void {
    this.router.navigate(['/vendor/products/import']);
  }
}
