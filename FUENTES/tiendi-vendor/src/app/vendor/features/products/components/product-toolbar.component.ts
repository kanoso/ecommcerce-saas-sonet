import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { Category, ProductFilters } from '../products.store';

@Component({
  selector: 'td-product-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-toolbar.component.html',
  styleUrl: './product-toolbar.component.scss',
})
export class ProductToolbarComponent {
  filters = input.required<ProductFilters>();
  viewMode = input.required<string>();
  categories = input<Category[]>([]);

  filtersChange = output<Partial<ProductFilters>>();
  viewModeChange = output<string>();
  newProduct = output<void>();
  importCsv = output<void>();
}
