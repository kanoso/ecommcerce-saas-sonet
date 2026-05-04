import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Product } from '../products.store';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/molecules/empty-state.component';

@Component({
  selector: 'td-product-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, SkeletonComponent, EmptyStateComponent],
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.scss',
})
export class ProductGridComponent {
  products = input.required<Product[]>();
  isLoading = input<boolean>(false);

  edit = output<string>();
  delete = output<string>();
  toggleActive = output<{ id: string; isActive: boolean }>();

  readonly skeletons = [1, 2, 3, 4, 5, 6];
  deletingId = signal<string | null>(null);

  getCategoryName(categoryId: string): string {
    const map: Record<string, string> = {
      cat1: 'Abarrotes', cat2: 'Lácteos', cat3: 'Bebidas',
      cat4: 'Snacks', cat5: 'Limpieza', cat6: 'Panadería',
    };
    return map[categoryId] ?? categoryId;
  }

  requestDelete(id: string): void {
    this.deletingId.set(id);
  }

  confirmDelete(id: string): void {
    this.delete.emit(id);
    this.deletingId.set(null);
  }

  cancelDelete(): void {
    this.deletingId.set(null);
  }
}
