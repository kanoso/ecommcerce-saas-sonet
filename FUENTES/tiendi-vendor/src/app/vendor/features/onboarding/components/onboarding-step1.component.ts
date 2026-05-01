import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoreData } from '../onboarding.store';
import { OnboardingNavComponent } from './onboarding-nav.component';

@Component({
  selector: 'app-onboarding-step1',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, OnboardingNavComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="onNext()" class="step">
      <div class="step__logo-wrap">
        <div
          class="step__logo"
          [class.step__logo--has-image]="logoPreview"
          (click)="fileInput.click()"
          role="button"
          tabindex="0"
          aria-label="Subir logo de la tienda"
          (keydown.enter)="fileInput.click()">
          @if (logoPreview) {
            <img [src]="logoPreview" alt="Logo de la tienda" class="step__logo-img" />
          } @else {
            <span class="step__logo-initials">{{ initials }}</span>
          }
          <div class="step__logo-overlay">
            <span class="material-icons-outlined">add_a_photo</span>
          </div>
        </div>
        <input
          #fileInput
          type="file"
          accept="image/*"
          style="display:none"
          (change)="onLogoChange($event)" />
        <p class="step__logo-hint">Foto de perfil de la tienda</p>
      </div>

      <div class="step__field">
        <label class="step__label" for="storeName">
          Nombre de la tienda <span class="step__required">*</span>
        </label>
        <input
          id="storeName"
          type="text"
          formControlName="name"
          class="step__input"
          [class.step__input--error]="form.get('name')?.invalid && form.get('name')?.touched"
          placeholder="Ej: Bodega Don Carlos"
          maxlength="60" />
        @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
          <p class="step__error">El nombre es obligatorio</p>
        }
        @if (form.get('name')?.hasError('maxlength')) {
          <p class="step__error">Máximo 60 caracteres</p>
        }
      </div>

      <div class="step__field">
        <label class="step__label" for="storeDesc">Descripción corta</label>
        <textarea
          id="storeDesc"
          formControlName="description"
          class="step__input step__textarea"
          [class.step__input--error]="form.get('description')?.hasError('maxlength')"
          placeholder="Ej: Verduras frescas, abarrotes y más. Delivery en 30 min."
          rows="2"
          maxlength="200">
        </textarea>
        @if (form.get('description')?.hasError('maxlength')) {
          <p class="step__error">Máximo 200 caracteres</p>
        }
      </div>

      <div class="step__field">
        <label class="step__label" for="storeAddress">Dirección</label>
        <input
          id="storeAddress"
          type="text"
          formControlName="address"
          class="step__input"
          placeholder="Ej: Jr. Lima 123, Miraflores" />
      </div>

      <div class="step__field">
        <label class="step__label" for="storeWhatsapp">WhatsApp</label>
        <input
          id="storeWhatsapp"
          type="tel"
          formControlName="whatsapp"
          class="step__input"
          placeholder="+51 987 654 321" />
      </div>

      <app-onboarding-nav
        [step]="1"
        (next)="onNext()"
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

    .step__logo-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .step__logo {
      position: relative;
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: var(--primary-light);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      overflow: hidden;
      border: 2px dashed var(--primary);
      transition: border-color 0.2s;
    }

    .step__logo--has-image {
      border-style: solid;
    }

    .step__logo:hover .step__logo-overlay {
      opacity: 1;
    }

    .step__logo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .step__logo-initials {
      font-size: 28px;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
    }

    .step__logo-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
      border-radius: 50%;
    }

    .step__logo-overlay .material-icons-outlined {
      color: #fff;
      font-size: 24px;
    }

    .step__logo-hint {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 0;
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

    .step__textarea {
      resize: vertical;
      min-height: 60px;
    }

    .step__error {
      font-size: 12px;
      color: var(--danger);
      margin: 0;
    }
  `],
})
export class OnboardingStep1Component implements OnInit {
  data = input.required<StoreData>();
  dataChange = output<Partial<StoreData>>();
  next = output<void>();
  skip = output<void>();

  logoPreview: string | null = null;

  get initials(): string {
    const name = (this.form?.get('name')?.value as string) ?? '';
    return name.trim().slice(0, 2) || '🏪';
  }

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    description: ['', [Validators.maxLength(200)]],
    address: [''],
    whatsapp: [''],
  });

  ngOnInit(): void {
    const d = this.data();
    this.form.patchValue({
      name: d.name,
      description: d.description,
      address: d.address,
      whatsapp: d.whatsapp,
    });
    if (d.logoUrl) {
      this.logoPreview = d.logoUrl;
    }
  }

  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.logoPreview = base64;
      this.dataChange.emit({ logoUrl: base64 });
    };
    reader.readAsDataURL(file);
  }

  onNext(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dataChange.emit(this.form.value as Partial<StoreData>);
    this.next.emit();
  }
}
