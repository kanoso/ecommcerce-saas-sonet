import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/molecules/empty-state.component';
import { LowStockProduct } from '../dashboard.store';

@Component({
  selector: 'app-low-stock-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, SkeletonComponent, EmptyStateComponent],
  templateUrl: './low-stock-widget.component.html',
  styleUrl: './low-stock-widget.component.scss',
})
export class LowStockWidgetComponent {
  products = input.required<LowStockProduct[]>();
  isLoading = input<boolean>(false);

  stockUpdate = output<{ productId: string; newStock: number }>();

  readonly skeletonRows = Array(3);

  editingId = signal<string | null>(null);
  editValue = signal<number>(0);

  startEdit(product: LowStockProduct): void {
    this.editingId.set(product.id);
    this.editValue.set(product.stock + 1);
  }

  confirmEdit(): void {
    const id = this.editingId();
    if (id !== null) {
      this.stockUpdate.emit({ productId: id, newStock: this.editValue() });
      this.editingId.set(null);
    }
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }
}
