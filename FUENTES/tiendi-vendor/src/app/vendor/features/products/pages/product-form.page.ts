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
  templateUrl: './product-form.page.html',
  styleUrl: './product-form.page.scss',
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
