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
  template: `
    <div class="form-info" [formGroup]="form">

      <!-- Card: Información básica -->
      <div class="card">
        <h3 class="card__title">Información básica</h3>

        <div class="field">
          <label class="field__label" for="name">
            Nombre del producto <span class="field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="name"
            class="field__input"
            [class.field__input--error]="isInvalid('name')"
            type="text"
            formControlName="name"
            placeholder="Ej: Leche Gloria 400ml"
            maxlength="100"
            aria-required="true"
            [attr.aria-describedby]="isInvalid('name') ? 'name-error' : null"
          />
          @if (isInvalid('name')) {
            <p id="name-error" class="field__error" role="alert">El nombre es requerido (máx. 100 caracteres)</p>
          }
        </div>

        <div class="field">
          <label class="field__label" for="description">
            Descripción
            <span class="field__counter" aria-live="polite">
              {{ form.controls.description.value.length }}/150
            </span>
          </label>
          <textarea
            id="description"
            class="field__input field__textarea"
            formControlName="description"
            placeholder="Descripción breve del producto..."
            maxlength="150"
            rows="3"
            aria-describedby="desc-count"
          ></textarea>
        </div>

        <div class="field">
          <label class="field__label" for="categoryId">
            Categoría <span class="field__required" aria-hidden="true">*</span>
          </label>
          <select
            id="categoryId"
            class="field__input field__select"
            [class.field__input--error]="isInvalid('categoryId')"
            formControlName="categoryId"
            aria-required="true"
          >
            <option value="">Seleccionar categoría</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
          @if (isInvalid('categoryId')) {
            <p class="field__error" role="alert">Seleccioná una categoría</p>
          }
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field__label" for="sku">SKU</label>
            <input
              id="sku"
              class="field__input"
              type="text"
              formControlName="sku"
              placeholder="Ej: GLO-001"
            />
          </div>
          <div class="field">
            <label class="field__label" for="presentation">Presentación</label>
            <input
              id="presentation"
              class="field__input"
              type="text"
              formControlName="presentation"
              placeholder="Ej: 400ml, 1kg, 6 unid"
            />
          </div>
        </div>
      </div>

      <!-- Card: Precio y stock -->
      <div class="card">
        <h3 class="card__title">Precio y stock</h3>

        <div class="field-row">
          <div class="field">
            <label class="field__label" for="price">
              Precio (S/) <span class="field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="price"
              class="field__input"
              [class.field__input--error]="isInvalid('price')"
              type="number"
              formControlName="price"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              aria-required="true"
            />
            @if (isInvalid('price')) {
              <p class="field__error" role="alert">Ingresá un precio válido</p>
            }
          </div>
          <div class="field">
            <label class="field__label" for="discountPrice">Precio oferta (S/)</label>
            <input
              id="discountPrice"
              class="field__input"
              type="number"
              formControlName="discountPrice"
              placeholder="Opcional"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field__label" for="stock">
              Stock <span class="field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="stock"
              class="field__input"
              [class.field__input--error]="isInvalid('stock')"
              type="number"
              formControlName="stock"
              placeholder="0"
              min="0"
              aria-required="true"
            />
            @if (isInvalid('stock')) {
              <p class="field__error" role="alert">El stock debe ser 0 o mayor</p>
            }
          </div>
          <div class="field">
            <label class="field__label" for="stockAlert">Alerta de stock</label>
            <input
              id="stockAlert"
              class="field__input"
              type="number"
              formControlName="stockAlert"
              placeholder="5"
              min="0"
            />
          </div>
        </div>

        @if (showStockAlert()) {
          <div class="stock-warning" role="status" aria-live="polite">
            <span class="material-icons-outlined" aria-hidden="true">warning</span>
            Stock bajo — se notificará cuando baje de {{ form.controls.stockAlert.value }} unidades
          </div>
        }
      </div>

      <!-- Card: Opciones -->
      <div class="card">
        <h3 class="card__title">Opciones</h3>

        <div class="toggle-list">
          <div class="toggle-item">
            <div class="toggle-item__text">
              <span class="toggle-item__label">Producto activo</span>
              <span class="toggle-item__desc">El producto es visible en tu tienda</span>
            </div>
            <label class="toggle" aria-label="Activar producto">
              <input type="checkbox" formControlName="isActive" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-item__text">
              <span class="toggle-item__label">Oferta del día</span>
              <span class="toggle-item__desc">Aparece destacado en la sección de ofertas</span>
            </div>
            <label class="toggle" aria-label="Marcar como oferta del día">
              <input type="checkbox" formControlName="isDailyOffer" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-item__text">
              <span class="toggle-item__label">Producto destacado</span>
              <span class="toggle-item__desc">Se muestra en la sección principal de la tienda</span>
            </div>
            <label class="toggle" aria-label="Marcar como destacado">
              <input type="checkbox" formControlName="isFeatured" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .form-info {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
    }

    .card__title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;

      &:last-child { margin-bottom: 0; }
    }

    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;

      .field { margin-bottom: 0; }
    }

    .field__label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .field__required {
      color: var(--danger);
      font-size: 14px;
    }

    .field__counter {
      font-size: 11px;
      color: var(--text-secondary);
      font-weight: 400;
    }

    .field__input {
      padding: 9px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 14px;
      font-family: inherit;
      color: var(--text-primary);
      background: var(--card);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;

      &:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-light);
      }

      &--error {
        border-color: var(--danger);
        &:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15); }
      }
    }

    .field__textarea {
      resize: vertical;
      min-height: 72px;
    }

    .field__select {
      cursor: pointer;
    }

    .field__error {
      margin: 0;
      font-size: 12px;
      color: var(--danger);
    }

    .stock-warning {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 12px;
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      border-radius: var(--radius);
      font-size: 13px;
      color: #92400E;
      margin-top: 4px;

      .material-icons-outlined { font-size: 18px; flex-shrink: 0; }
    }

    .toggle-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .toggle-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);

      &:last-child { border-bottom: none; padding-bottom: 0; }
      &:first-child { padding-top: 0; }
    }

    .toggle-item__text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toggle-item__label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .toggle-item__desc {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
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

    @media (max-width: 480px) {
      .field-row { grid-template-columns: 1fr; }
    }
  `],
})
export class ProductFormInfoComponent implements OnInit {
  product = input<Partial<Product> | null>(null);
  categories = input.required<Category[]>();

  formChange = output<Partial<Product>>();

  private fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(150)],
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
        description: p.description ?? '',
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
