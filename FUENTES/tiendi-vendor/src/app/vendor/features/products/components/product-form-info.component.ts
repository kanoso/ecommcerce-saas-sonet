import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Category, Product } from '../products.store';

@Component({
  selector: 'td-product-form-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './product-form-info.component.html',
  styleUrl: './product-form-info.component.scss',
})
export class ProductFormInfoComponent implements OnInit {
  product = input<Partial<Product> | null>(null);
  categories = input.required<Category[]>();

  formChange = output<Partial<Product>>();

  private fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    shortDescription: ['', Validators.maxLength(100)],
    description: [''],
    tags: [''],
    categoryId: ['', Validators.required],
    sku: [''],
    presentation: [''],
    price: [0, [Validators.required, Validators.min(0.01)]],
    discountPrice: [null as number | null],
    stock: [0, [Validators.required, Validators.min(0)]],
    stockAlert: [5],
    isActive: [true],
    isDailyOffer: [false],
    isFeatured: [false],
  });

  showStockAlert = signal(false);

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((val) => {
        this.formChange.emit(val as Partial<Product>);
        const stock = val.stock ?? 0;
        const alert = val.stockAlert ?? 5;
        this.showStockAlert.set(stock >= 0 && stock < alert);
      });
  }

  ngOnInit(): void {
    const p = this.product();
    if (p) {
      this.form.patchValue({
        name: p.name ?? '',
        shortDescription: p.shortDescription ?? '',
        description: p.description ?? '',
        tags: p.tags ?? '',
        categoryId: p.categoryId ?? '',
        sku: p.sku ?? '',
        presentation: p.presentation ?? '',
        price: p.price ?? 0,
        discountPrice: p.discountPrice ?? null,
        stock: p.stock ?? 0,
        stockAlert: p.stockAlert ?? 5,
        isActive: p.isActive ?? true,
      });
    }
  }

  isInvalid(field: keyof typeof this.form.controls): boolean {
    const ctrl = this.form.controls[field];
    return ctrl.invalid && ctrl.touched;
  }
}
