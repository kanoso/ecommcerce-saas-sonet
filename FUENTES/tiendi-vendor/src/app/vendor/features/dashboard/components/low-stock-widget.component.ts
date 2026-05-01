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
  template: `
    <div class="widget" role="region" aria-label="Productos con stock bajo">
      <div class="widget__header">
        <h2 class="widget__title">⚠️ Productos con stock bajo</h2>
        <a routerLink="/vendor/products" class="widget__link">Ver todos →</a>
      </div>

      <div class="widget__body">
        @if (isLoading()) {
          <table class="stock-table" aria-busy="true">
            <tbody>
              @for (row of skeletonRows; track $index) {
                <tr>
                  <td><td-skeleton variant="line" width="140px" /></td>
                  <td><td-skeleton variant="line" width="80px" /></td>
                  <td><td-skeleton variant="line" width="60px" /></td>
                  <td><td-skeleton variant="line" width="60px" /></td>
                  <td><td-skeleton variant="line" width="100px" /></td>
                </tr>
              }
            </tbody>
          </table>
        } @else if (products().length === 0) {
          <td-empty-state
            title="Sin productos con stock bajo 🎉"
            message="Todos tus productos tienen stock suficiente."
            icon="check_circle"
          />
        } @else {
          <table class="stock-table">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Categoría</th>
                <th scope="col">Precio</th>
                <th scope="col">Stock</th>
                <th scope="col"><span class="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              @for (product of products(); track product.id) {
                <tr>
                  <td class="stock-table__name">{{ product.name }}</td>
                  <td class="stock-table__category">{{ product.categoryId }}</td>
                  <td>S/ {{ product.price.toFixed(2) }}</td>
                  <td>
                    @if (product.stock === 0) {
                      <span class="stock-zero">0 unidades 🔴</span>
                    } @else {
                      <span class="stock-low">{{ product.stock }} unidades ⚠️</span>
                    }
                  </td>
                  <td>
                    @if (editingId() === product.id) {
                      <div class="stock-edit" role="group" [attr.aria-label]="'Editar stock de ' + product.name">
                        <input
                          class="stock-edit__input"
                          type="number"
                          [ngModel]="editValue()"
                          (ngModelChange)="editValue.set($event)"
                          min="0"
                          [attr.aria-label]="'Nuevo stock para ' + product.name"
                        />
                        <button
                          class="stock-edit__btn stock-edit__btn--confirm"
                          (click)="confirmEdit()"
                          aria-label="Confirmar stock"
                        >✓</button>
                        <button
                          class="stock-edit__btn stock-edit__btn--cancel"
                          (click)="cancelEdit()"
                          aria-label="Cancelar edición"
                        >✗</button>
                      </div>
                    } @else {
                      <button
                        class="stock-table__btn"
                        (click)="startEdit(product)"
                        [attr.aria-label]="'Agregar stock a ' + product.name"
                      >Agregar stock</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
  styles: [`
    .widget {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .widget__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .widget__title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .widget__link {
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;

      &:hover { text-decoration: underline; }
    }

    .widget__body {
      padding: 0;
    }

    .stock-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid var(--border);
      }

      th {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--text-secondary);
        background: var(--surface);
      }

      tr:last-child td {
        border-bottom: none;
      }

      tr:hover td {
        background: var(--surface);
      }
    }

    .stock-table__name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .stock-table__category {
      color: var(--text-secondary);
      font-size: 12px;
    }

    .stock-table__btn {
      background: var(--primary-light);
      border: 1px solid transparent;
      border-radius: var(--radius);
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 500;
      color: var(--primary);
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: var(--primary);
        color: #fff;
      }
    }

    .stock-edit {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stock-edit__input {
      width: 64px;
      padding: 4px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 13px;
      color: var(--text-primary);
      outline: none;

      &:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--primary-light);
      }
    }

    .stock-edit__btn {
      width: 28px;
      height: 28px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;

      &--confirm {
        background: var(--primary-light);
        color: var(--primary);
        border-color: var(--primary);

        &:hover {
          background: var(--primary);
          color: #fff;
        }
      }

      &--cancel {
        background: none;
        color: var(--text-secondary);

        &:hover {
          background: #fee2e2;
          color: var(--danger);
          border-color: var(--danger);
        }
      }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `],
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
