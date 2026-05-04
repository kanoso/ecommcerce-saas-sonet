import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { Category } from '../products.store';

interface GlobalCategory {
  id: string;
  name: string;
  icon: string;
  subcategories: string[];
  count: number;
}

const GLOBAL_CATEGORIES: GlobalCategory[] = [
  { id: 'cat1', name: 'Abarrotes', icon: 'local_grocery_store', subcategories: ['Arroz', 'Fideos', 'Aceites', 'Conservas'], count: 0 },
  { id: 'cat2', name: 'Lácteos', icon: 'egg_alt', subcategories: ['Leche', 'Yogurt', 'Queso', 'Mantequilla'], count: 0 },
  { id: 'cat3', name: 'Bebidas', icon: 'local_drink', subcategories: ['Agua', 'Gaseosas', 'Jugos', 'Energizantes'], count: 0 },
  { id: 'cat4', name: 'Snacks', icon: 'cookie', subcategories: ['Galletas', 'Papas fritas', 'Chocolates', 'Caramelos'], count: 0 },
  { id: 'cat5', name: 'Limpieza', icon: 'cleaning_services', subcategories: ['Detergente', 'Desinfectante', 'Papel higiénico', 'Jabón'], count: 0 },
  { id: 'cat6', name: 'Panadería', icon: 'bakery_dining', subcategories: ['Pan', 'Tortas', 'Pasteles', 'Muffins'], count: 0 },
];

@Component({
  selector: 'td-product-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-categories.component.html',
  styleUrl: './product-categories.component.scss',
})
export class ProductCategoriesComponent {
  categories = input.required<Category[]>();

  readonly globalCats = GLOBAL_CATEGORIES;
  expandedId = signal<string | null>(null);
  selectedCat = signal<GlobalCategory | null>(null);

  get totalSubcategories(): number {
    return GLOBAL_CATEGORIES.reduce((sum, c) => sum + c.subcategories.length, 0);
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }
}
