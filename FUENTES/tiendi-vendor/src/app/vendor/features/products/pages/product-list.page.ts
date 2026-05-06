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
  templateUrl: './product-list.page.html',
  styleUrl: './product-list.page.scss',
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
