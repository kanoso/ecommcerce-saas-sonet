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
  selector: 'td-product-list-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, SkeletonComponent, EmptyStateComponent],
  template: `
    @if (isLoading()) {
      <div class="table-wrap">
        <table class="table" aria-label="Cargando productos" aria-busy="true">
          <thead>
            <tr>
              <th>Producto</th><th>Categoría</th><th>Precio</th>
              <th>Stock</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (n of skeletons; track n) {
              <tr>
                <td><td-skeleton variant="line" /></td>
                <td><td-skeleton variant="line" width="80px" /></td>
                <td><td-skeleton variant="line" width="60px" /></td>
                <td><td-skeleton variant="line" width="50px" /></td>
                <td><td-skeleton variant="line" width="40px" /></td>
                <td><td-skeleton variant="line" width="80px" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (products().length === 0) {
      <td-empty-state
        title="Sin productos aún"
        message="Agregá tu primer producto para empezar a vender"
        icon="inventory_2"
        actionLabel="Agregar producto"
        (action)="edit.emit('new')"
      />
    } @else {
      <div class="table-wrap" role="region" aria-label="Lista de productos">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Categoría</th>
              <th scope="col">Precio</th>
              <th scope="col">Stock</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (product of products(); track product.id) {
              <tr [class.table__row--inactive]="!product.isActive">
                <td>
                  <div class="table__product">
                    <div class="table__thumb">
                      @if (product.imageUrls.length > 0) {
                        <img [src]="product.imageUrls[0]" [alt]="product.name" class="table__img" />
                      } @else {
                        <span class="material-icons-outlined table__no-img" aria-hidden="true">inventory_2</span>
                      }
                    </div>
                    <div>
                      <p class="table__name">{{ product.name }}</p>
                      <p class="table__sku">SKU: {{ product.sku }}</p>
                    </div>
                  </div>
                </td>
                <td class="table__cell--muted">{{ getCategoryName(product.categoryId) }}</td>
                <td>
                  @if (product.discountPrice) {
                    <span class="table__price-offer">S/ {{ product.discountPrice | number:'1.2-2' }}</span>
                    <span class="table__price-orig">S/ {{ product.price | number:'1.2-2' }}</span>
                  } @else {
                    <span class="table__price">S/ {{ product.price | number:'1.2-2' }}</span>
                  }
                </td>
                <td>
                  <span
                    class="table__stock"
                    [class.table__stock--out]="product.stock === 0"
                    [class.table__stock--low]="product.stock > 0 && product.stock <= product.stockAlert"
                  >
                    {{ product.stock }} uds
                  </span>
                </td>
                <td>
                  <label class="toggle" [attr.aria-label]="(product.isActive ? 'Desactivar' : 'Activar') + ' ' + product.name">
                    <input
                      type="checkbox"
                      [checked]="product.isActive"
                      (change)="toggleActive.emit({ id: product.id, isActive: $any($event.target).checked })"
                    />
                    <span class="slider"></span>
                  </label>
                </td>
                <td>
                  @if (deletingId() === product.id) {
                    <div class="table__confirm" role="alertdialog">
                      <button class="table__action table__action--danger" (click)="confirmDelete(product.id)" type="button">Eliminar</button>
                      <button class="table__action table__action--cancel" (click)="cancelDelete()" type="button">Cancelar</button>
                    </div>
                  } @else {
                    <div class="table__actions">
                      <button
                        class="table__action table__action--edit"
                        (click)="edit.emit(product.id)"
                        type="button"
                        [attr.aria-label]="'Editar ' + product.name"
                      >
                        <span class="material-icons-outlined" aria-hidden="true">edit</span>
                      </button>
                      <button
                        class="table__action table__action--delete"
                        (click)="requestDelete(product.id)"
                        type="button"
                        [attr.aria-label]="'Eliminar ' + product.name"
                      >
                        <span class="material-icons-outlined" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--card);
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;

      th {
        padding: 12px 16px;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.4px;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }

      td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
        color: var(--text-primary);
      }

      tr:last-child td { border-bottom: none; }
      tr:hover td { background: var(--surface); }
    }

    .table__row--inactive td { opacity: 0.55; }

    .table__product {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .table__thumb {
      width: 40px;
      height: 40px;
      border-radius: var(--radius);
      background: var(--surface);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }

    .table__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .table__no-img {
      font-size: 20px;
      color: var(--border);
    }

    .table__name {
      margin: 0;
      font-weight: 600;
      white-space: nowrap;
    }

    .table__sku {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .table__cell--muted { color: var(--text-secondary); }

    .table__price { font-weight: 600; }
    .table__price-offer { font-weight: 700; color: var(--primary); display: block; }
    .table__price-orig { font-size: 11px; color: var(--text-secondary); text-decoration: line-through; }

    .table__stock {
      font-weight: 500;
      color: var(--primary);

      &--low { color: #B45309; }
      &--out { color: #B91C1C; }
    }

    .toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      cursor: pointer;

      input { opacity: 0; width: 0; height: 0; }

      .slider {
        position: absolute;
        inset: 0;
        background: #CBD5E1;
        border-radius: 12px;
        transition: 0.3s;

        &::before {
          content: '';
          position: absolute;
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background: white;
          border-radius: 50%;
          transition: 0.3s;
        }
      }

      input:checked + .slider { background: var(--primary); }
      input:checked + .slider::before { transform: translateX(20px); }
    }

    .table__actions {
      display: flex;
      gap: 4px;
    }

    .table__confirm {
      display: flex;
      gap: 4px;
    }

    .table__action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border: none;
      border-radius: var(--radius);
      font-size: 12px;
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;

      .material-icons-outlined { font-size: 16px; }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }

      &--edit {
        background: var(--surface);
        color: var(--text-secondary);
        border: 1px solid var(--border);
        &:hover { background: var(--border); color: var(--text-primary); }
      }

      &--delete {
        background: #FEE2E2;
        color: #B91C1C;
        &:hover { background: #FECACA; }
      }

      &--danger {
        background: var(--danger);
        color: #fff;
        &:hover { filter: brightness(0.9); }
      }

      &--cancel {
        background: var(--surface);
        color: var(--text-secondary);
        border: 1px solid var(--border);
        &:hover { background: var(--border); }
      }
    }
  `],
})
export class ProductListTableComponent {
  products = input.required<Product[]>();
  isLoading = input<boolean>(false);

  edit = output<string>();
  delete = output<string>();
  toggleActive = output<{ id: string; isActive: boolean }>();

  readonly skeletons = [1, 2, 3, 4, 5];
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
