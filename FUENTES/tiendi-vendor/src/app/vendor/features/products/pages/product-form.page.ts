import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Product, ProductsStore } from '../products.store';
import { ProductFormInfoComponent } from '../components/product-form-info.component';
import { ProductImageUploadComponent } from '../components/product-image-upload.component';
import { ProductPreviewCardComponent } from '../components/product-preview-card.component';

@Component({
  selector: 'td-product-form-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ProductFormInfoComponent,
    ProductImageUploadComponent,
    ProductPreviewCardComponent,
  ],
  template: `
    <div class="form-page">

      <!-- Header -->
      <div class="form-page__header">
        <button
          class="form-page__back"
          (click)="goBack()"
          type="button"
          aria-label="Volver a lista de productos"
        >
          <span class="material-icons-outlined" aria-hidden="true">arrow_back</span>
        </button>
        <div>
          <h1 class="form-page__title">{{ isEditMode() ? 'Editar producto' : 'Nuevo producto' }}</h1>
          <p class="form-page__subtitle">
            {{ isEditMode() ? 'Modificá la información del producto' : 'Completá los datos para agregar un producto a tu catálogo' }}
          </p>
        </div>
      </div>

      @if (store.error()) {
        <div class="form-page__error" role="alert">
          <span class="material-icons-outlined" aria-hidden="true">error_outline</span>
          {{ store.error() }}
        </div>
      }

      <!-- Layout 2 columnas -->
      <div class="form-page__layout">
        <!-- Columna izquierda: formulario -->
        <div class="form-page__main">
          <td-product-form-info
            [product]="currentProduct()"
            [categories]="store.categories()"
            (formChange)="onFormChange($event)"
          />
        </div>

        <!-- Columna derecha: imágenes + preview + acciones -->
        <div class="form-page__aside">
          <div class="aside-card">
            <td-product-image-upload
              [imageUrls]="imageUrls()"
              (imagesChange)="imageUrls.set($event)"
            />
          </div>

          <div class="aside-card">
            <td-product-preview-card
              [name]="previewName()"
              [price]="previewPrice()"
              [discountPrice]="previewDiscountPrice()"
              [imageUrl]="imageUrls().length > 0 ? imageUrls()[0] : null"
            />
          </div>

          <div class="aside-actions">
            <button
              class="aside-actions__save"
              (click)="onSubmit()"
              [disabled]="store.isSaving()"
              type="button"
              aria-label="{{ isEditMode() ? 'Guardar cambios' : 'Crear producto' }}"
            >
              @if (store.isSaving()) {
                <span class="aside-actions__spinner" aria-hidden="true"></span>
                <span class="sr-only">Guardando...</span>
              } @else {
                <span class="material-icons-outlined" aria-hidden="true">save</span>
                {{ isEditMode() ? 'Guardar cambios' : 'Crear producto' }}
              }
            </button>
            <button
              class="aside-actions__cancel"
              (click)="goBack()"
              type="button"
              [disabled]="store.isSaving()"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .form-page {
      padding: 24px;
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-page__header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .form-page__back {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--card);
      color: var(--text-secondary);
      cursor: pointer;
      flex-shrink: 0;
      margin-top: 2px;
      transition: background 0.15s;

      .material-icons-outlined { font-size: 20px; }
      &:hover { background: var(--surface); color: var(--text-primary); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }
    }

    .form-page__title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .form-page__subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 4px 0 0;
    }

    .form-page__error {
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

    .form-page__layout {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 20px;
      align-items: start;
    }

    .form-page__main {
      min-width: 0;
    }

    .form-page__aside {
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: sticky;
      top: 16px;
    }

    .aside-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px;
    }

    .aside-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .aside-actions__save {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 11px 16px;
      border: none;
      border-radius: var(--radius);
      background: var(--primary);
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;

      .material-icons-outlined { font-size: 18px; }

      &:hover:not(:disabled) { background: var(--primary-dark); }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }
    }

    .aside-actions__spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .aside-actions__cancel {
      width: 100%;
      padding: 9px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--card);
      color: var(--text-secondary);
      font-size: 14px;
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;

      &:hover:not(:disabled) { background: var(--surface); }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 768px) {
      .form-page { padding: 16px; }
      .form-page__layout { grid-template-columns: 1fr; }
      .form-page__aside { position: static; }
    }
  `],
})
export class ProductFormPage implements OnInit {
  protected store = inject(ProductsStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private productId = signal<string | null>(null);
  private formData = signal<Partial<Product>>({});

  isEditMode = computed(() => !!this.productId());
  currentProduct = computed(() => {
    const id = this.productId();
    if (!id) return null;
    return this.store.products().find((p) => p.id === id) ?? null;
  });

  imageUrls = signal<string[]>([]);

  previewName = computed(() => this.formData().name ?? this.currentProduct()?.name ?? '');
  previewPrice = computed(() => this.formData().price ?? this.currentProduct()?.price ?? null);
  previewDiscountPrice = computed(
    () => this.formData().discountPrice ?? this.currentProduct()?.discountPrice ?? null
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productId.set(id);
      const existing = this.store.products().find((p) => p.id === id);
      if (existing) {
        this.imageUrls.set([...existing.imageUrls]);
      } else {
        this.store.loadProducts();
      }
    }
  }

  onFormChange(data: Partial<Product>): void {
    this.formData.set(data);
  }

  onSubmit(): void {
    const data = this.formData();
    const id = this.productId();

    const payload: Omit<Product, 'id' | 'createdAt'> = {
      storeId: 's1',
      name: data.name ?? '',
      description: data.description ?? '',
      categoryId: data.categoryId ?? '',
      presentation: data.presentation ?? '',
      sku: data.sku ?? '',
      price: data.price ?? 0,
      discountPrice: data.discountPrice ?? null,
      stock: data.stock ?? 0,
      stockAlert: data.stockAlert ?? 5,
      isActive: data.isActive ?? true,
      isAvailable: true,
      imageUrls: this.imageUrls(),
    };

    if (id) {
      this.store.updateProduct(id, { ...payload, id });
    } else {
      this.store.createProduct(payload);
    }

    this.router.navigate(['/vendor/products']);
  }

  goBack(): void {
    this.router.navigate(['/vendor/products']);
  }
}
