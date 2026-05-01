import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductData } from '../onboarding.store';
import { OnboardingNavComponent } from './onboarding-nav.component';

@Component({
  selector: 'app-onboarding-step2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, OnboardingNavComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="onNext()" class="step">
      <div class="step__field">
        <span class="step__label" id="product-image-label">Imagen del producto</span>
        <div
          class="step__dropzone"
          [class.step__dropzone--has-image]="imagePreview"
          (click)="fileInput.click()"
          (dragover)="onDragOver($event)"
          (drop)="onDrop($event)"
          role="button"
          tabindex="0"
          aria-labelledby="product-image-label"
          (keydown.enter)="fileInput.click()">
          @if (imagePreview) {
            <img [src]="imagePreview" alt="Imagen del producto" class="step__dropzone-img" />
          } @else {
            <span class="material-icons-outlined step__dropzone-icon">image</span>
            <span class="step__dropzone-text">Arrastrá o hacé click para subir</span>
          }
        </div>
        <input
          #fileInput
          type="file"
          accept="image/*"
          style="display:none"
          (change)="onFileChange($event)" />
      </div>

      <div class="step__field">
        <label class="step__label" for="productName">
          Nombre del producto <span class="step__required">*</span>
        </label>
        <input
          id="productName"
          type="text"
          formControlName="name"
          class="step__input"
          [class.step__input--error]="form.get('name')?.invalid && form.get('name')?.touched"
          placeholder="Ej: Arroz Costeño 5kg" />
        @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
          <p class="step__error">El nombre es obligatorio</p>
        }
      </div>

      <div class="step__grid">
        <div class="step__field">
          <label class="step__label" for="productPrice">Precio (S/)</label>
          <div class="step__input-wrap">
            <span class="step__prefix">S/</span>
            <input
              id="productPrice"
              type="number"
              formControlName="price"
              class="step__input step__input--prefixed"
              [class.step__input--error]="form.get('price')?.invalid && form.get('price')?.touched"
              placeholder="0.00"
              min="0"
              step="0.10" />
          </div>
          @if (form.get('price')?.hasError('min')) {
            <p class="step__error">El precio no puede ser negativo</p>
          }
        </div>

        <div class="step__field">
          <label class="step__label" for="productStock">Stock inicial</label>
          <input
            id="productStock"
            type="number"
            formControlName="stock"
            class="step__input"
            [class.step__input--error]="form.get('stock')?.invalid && form.get('stock')?.touched"
            placeholder="0"
            min="0" />
          @if (form.get('stock')?.hasError('min')) {
            <p class="step__error">El stock no puede ser negativo</p>
          }
        </div>
      </div>

      <app-onboarding-nav
        [step]="2"
        (next)="onNext()"
        (prev)="prev.emit()"
        (skip)="skip.emit()" />
    </form>
  `,
  styles: [`
    :host { display: block; }

    .step {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .step__field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .step__label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .step__required {
      color: var(--danger);
    }

    .step__dropzone {
      border: 2px dashed var(--border);
      border-radius: 10px;
      padding: 16px;
      cursor: pointer;
      height: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: border-color 0.2s, background 0.2s;
      overflow: hidden;
    }

    .step__dropzone:hover {
      border-color: var(--primary);
      background: var(--primary-light);
    }

    .step__dropzone--has-image {
      padding: 0;
      border-style: solid;
    }

    .step__dropzone-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }

    .step__dropzone-icon {
      font-size: 28px;
      color: var(--text-secondary);
    }

    .step__dropzone-text {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .step__input {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 9px 12px;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--card);
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
      width: 100%;
      box-sizing: border-box;
    }

    .step__input:focus {
      border-color: var(--primary);
    }

    .step__input--error {
      border-color: var(--danger);
    }

    .step__input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .step__prefix {
      position: absolute;
      left: 10px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      pointer-events: none;
    }

    .step__input--prefixed {
      padding-left: 32px;
    }

    .step__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .step__error {
      font-size: 12px;
      color: var(--danger);
      margin: 0;
    }
  `],
})
export class OnboardingStep2Component implements OnInit {
  data = input.required<ProductData>();
  dataChange = output<Partial<ProductData>>();
  next = output<void>();
  prev = output<void>();
  skip = output<void>();

  imagePreview: string | null = null;

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    price: [null as number | null, [Validators.min(0)]],
    stock: [null as number | null, [Validators.min(0)]],
  });

  ngOnInit(): void {
    const d = this.data();
    this.form.patchValue({ name: d.name, price: d.price, stock: d.stock });
    if (d.imageUrl) this.imagePreview = d.imageUrl;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFile(file);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.readFile(file);
  }

  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.imagePreview = base64;
      this.dataChange.emit({ imageUrl: base64 });
    };
    reader.readAsDataURL(file);
  }

  onNext(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dataChange.emit(this.form.value as Partial<ProductData>);
    this.next.emit();
  }
}
