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
  template: `
    @if (isLoading()) {
      <div class="product-grid" aria-label="Cargando productos" aria-busy="true">
        @for (n of skeletons; track n) {
          <div class="product-card">
            <td-skeleton variant="rect" height="120px" />
            <div class="product-card__body" style="display:flex;flex-direction:column;gap:8px;">
              <td-skeleton variant="line" width="60%" height="11px" />
              <td-skeleton variant="line" width="80%" height="14px" />
              <td-skeleton variant="line" width="40%" height="14px" />
              <td-skeleton variant="line" width="50%" height="12px" />
            </div>
          </div>
        }
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
      <div class="product-grid" role="list" [attr.aria-label]="products().length + ' productos'">
        @for (product of products(); track product.id) {
          <article class="product-card" role="listitem" [attr.aria-label]="product.name">
            <div class="product-card__img">
              @if (product.imageUrls.length > 0) {
                <img
                  [src]="product.imageUrls[0]"
                  [alt]="product.name"
                  class="product-card__image"
                />
              } @else {
                <span class="material-icons-outlined product-card__placeholder" aria-hidden="true">
                  inventory_2
                </span>
              }

              @if (product.stock === 0) {
                <span class="product-card__badge product-card__badge--out" aria-label="Sin stock">
                  Sin stock
                </span>
              } @else if (product.stock <= product.stockAlert) {
                <span class="product-card__badge product-card__badge--low" aria-label="Stock bajo">
                  Stock bajo
                </span>
              }
            </div>

            <div class="product-card__body">
              <span class="product-card__category">{{ getCategoryName(product.categoryId) }}</span>
              <h3 class="product-card__name">{{ product.name }}</h3>

              <div class="product-card__price">
                @if (product.discountPrice) {
                  <span class="product-card__price-offer">S/ {{ product.discountPrice | number:'1.2-2' }}</span>
                  <span class="product-card__price-original">S/ {{ product.price | number:'1.2-2' }}</span>
                } @else {
                  <span class="product-card__price-current">S/ {{ product.price | number:'1.2-2' }}</span>
                }
              </div>

              <div class="product-card__stock" [class.product-card__stock--out]="product.stock === 0" [class.product-card__stock--low]="product.stock > 0 && product.stock <= product.stockAlert">
                @if (product.stock === 0) {
                  <span class="material-icons-outlined" aria-hidden="true" style="font-size:14px">cancel</span>
                  0 uds
                } @else if (product.stock <= product.stockAlert) {
                  <span class="material-icons-outlined" aria-hidden="true" style="font-size:14px">warning</span>
                  {{ product.stock }} uds
                } @else {
                  <span class="material-icons-outlined" aria-hidden="true" style="font-size:14px">check_circle</span>
                  {{ product.stock }} uds
                }
              </div>

              @if (deletingId() === product.id) {
                <div class="product-card__confirm" role="alertdialog" aria-label="Confirmar eliminación">
                  <p class="product-card__confirm-msg">¿Eliminar este producto?</p>
                  <div class="product-card__confirm-actions">
                    <button
                      class="product-card__btn product-card__btn--danger"
                      (click)="confirmDelete(product.id)"
                      type="button"
                      aria-label="Confirmar eliminación de producto"
                    >Eliminar</button>
                    <button
                      class="product-card__btn product-card__btn--cancel"
                      (click)="cancelDelete()"
                      type="button"
                    >Cancelar</button>
                  </div>
                </div>
              } @else {
                <div class="product-card__actions">
                  <button
                    class="product-card__btn product-card__btn--edit"
                    (click)="edit.emit(product.id)"
                    type="button"
                    [attr.aria-label]="'Editar ' + product.name"
                  >
                    <span class="material-icons-outlined" aria-hidden="true">edit</span>
                    Editar
                  </button>
                  <button
                    class="product-card__btn product-card__btn--delete"
                    (click)="requestDelete(product.id)"
                    type="button"
                    [attr.aria-label]="'Eliminar ' + product.name"
                  >
                    <span class="material-icons-outlined" aria-hidden="true">delete</span>
                  </button>
                </div>
              }
            </div>
          </article>
        }
      </div>
    }
  `,
  styles: [`
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .product-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      transition: box-shadow 0.2s;

      &:hover { box-shadow: var(--shadow-md); }
    }

    .product-card__img {
      height: 120px;
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .product-card__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-card__placeholder {
      font-size: 40px;
      color: var(--border);
    }

    .product-card__badge {
      position: absolute;
      top: 8px;
      left: 8px;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
    }

    .product-card__badge--out {
      background: #FEE2E2;
      color: #991B1B;
    }

    .product-card__badge--low {
      background: #FEF3C7;
      color: #92400E;
    }

    .product-card__body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .product-card__category {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .product-card__name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .product-card__price {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }

    .product-card__price-current {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .product-card__price-offer {
      font-size: 15px;
      font-weight: 700;
      color: var(--primary);
    }

    .product-card__price-original {
      font-size: 12px;
      color: var(--text-secondary);
      text-decoration: line-through;
    }

    .product-card__stock {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--primary);
      font-weight: 500;

      &--low { color: #B45309; }
      &--out { color: #B91C1C; }
    }

    .product-card__actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .product-card__confirm {
      margin-top: 8px;
    }

    .product-card__confirm-msg {
      font-size: 12px;
      color: var(--text-primary);
      margin: 0 0 6px;
      font-weight: 500;
    }

    .product-card__confirm-actions {
      display: flex;
      gap: 6px;
    }

    .product-card__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
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
        flex: 1;
        background: var(--surface);
        color: var(--text-primary);
        border: 1px solid var(--border);
        &:hover { background: var(--border); }
      }

      &--delete {
        background: #FEE2E2;
        color: var(--danger);
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
