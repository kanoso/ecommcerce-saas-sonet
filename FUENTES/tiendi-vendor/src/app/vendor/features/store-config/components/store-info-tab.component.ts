import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StoreInfo } from '../store-config.store';

@Component({
  selector: 'app-store-info-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="info-layout">

      <!-- LEFT COLUMN -->
      <div class="info-col">
        <div class="card">
          <div class="card__header"><h3>Datos de la tienda</h3></div>
          <div class="card__body">

            <!-- Logo -->
            <div class="logo-row">
              <div class="logo-preview">
                @if (form.value.logoUrl) {
                  <img [src]="form.value.logoUrl" alt="Logo" class="logo-img">
                } @else {
                  <span class="logo-initials">{{ initial() }}</span>
                }
              </div>
              <div>
                <div class="logo-label">Logo de la tienda</div>
                <button type="button" class="btn btn--ghost btn--sm" (click)="logoInput.click()">
                  Cambiar logo
                </button>
                <input #logoInput type="file" accept="image/*" style="display:none" (change)="onLogoChange($event)">
                <div class="logo-hint">PNG o JPG, recomendado 200×200px</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="info-store-name">Nombre de la tienda <span class="req">*</span></label>
              <input id="info-store-name" type="text" class="form-input" formControlName="name">
            </div>

            <div class="form-group">
              <label class="form-label" for="info-description">Descripción</label>
              <textarea id="info-description" class="form-input" rows="3" formControlName="description"></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="info-category">Categoría</label>
                <select id="info-category" class="form-input" formControlName="category">
                  <option value="">Seleccionar...</option>
                  <option>Bodega / Minimarket</option>
                  <option>Panadería</option>
                  <option>Farmacia</option>
                  <option>Restaurante</option>
                  <option>Ferretería</option>
                  <option>Librería</option>
                  <option>Otro</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="info-phone">Teléfono</label>
                <input id="info-phone" type="tel" class="form-input" formControlName="phone">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="info-address">Dirección</label>
              <input id="info-address" type="text" class="form-input" formControlName="address">
            </div>
          </div>
        </div>

        <div class="actions">
          <button type="submit" class="btn btn--primary" [disabled]="isSaving()">
            @if (isSaving()) { Guardando... } @else { Guardar cambios }
          </button>
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="info-col">

        <!-- Store link -->
        <div class="card">
          <div class="card__header"><h3>Link de tu tienda</h3></div>
          <div class="card__body">
            <div class="link-row">
              <div class="link-display">
                tiendi.pe/<strong>{{ form.value.storeSlug || '...' }}</strong>
              </div>
              <button type="button" class="icon-btn" title="Copiar link" (click)="copyLink()">
                <span class="material-icons-outlined" style="font-size:20px">content_copy</span>
              </button>
            </div>
            <div class="link-hint">Compartí este link con tus clientes</div>
          </div>
        </div>

        <!-- Store status -->
        <div class="card">
          <div class="card__header"><h3>Estado de la tienda</h3></div>
          <div class="card__body">
            <div class="status-row">
              <div>
                <div class="status-label">Tienda abierta</div>
                <div class="status-hint">Los clientes pueden hacer pedidos</div>
              </div>
              <label class="toggle">
                <input type="checkbox" formControlName="isOpen" (change)="toggleOpen.emit()">
                <span class="slider"></span>
              </label>
            </div>
            <div class="status-indicator">
              <span
                class="status-dot"
                [class.status-dot--open]="form.value.isOpen"
                [class.status-dot--closed]="!form.value.isOpen"
              ></span>
              @if (form.value.isOpen) { Tienda activa y visible en el catálogo }
              @else { Tienda cerrada temporalmente }
            </div>
          </div>
        </div>

        <!-- Social media -->
        <div class="card">
          <div class="card__header"><h3>Redes sociales</h3></div>
          <div class="card__body">
            <div class="form-group">
              <label class="form-label" for="info-whatsapp">WhatsApp</label>
              <div class="social-row">
                <span class="material-icons-outlined" style="color:#25D366;font-size:20px">chat</span>
                <input id="info-whatsapp" type="tel" class="form-input" placeholder="+51 987 654 321" formControlName="whatsapp">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="info-instagram">Instagram</label>
              <div class="social-row">
                <span class="material-icons-outlined" style="color:#E1306C;font-size:20px">camera_alt</span>
                <input id="info-instagram" type="text" class="form-input" placeholder="@mi_tienda" formControlName="instagram">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="info-facebook">Facebook</label>
              <div class="social-row">
                <span class="material-icons-outlined" style="color:#1877F2;font-size:20px">facebook</span>
                <input id="info-facebook" type="text" class="form-input" placeholder="mi.tienda" formControlName="facebook">
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  `,
  styles: [`
    .info-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    .info-col { display: flex; flex-direction: column; gap: 20px; }

    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .card__header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .card__header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .card__body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

    .logo-row { display: flex; align-items: center; gap: 16px; }
    .logo-preview { width: 72px; height: 72px; border-radius: 12px; background: var(--primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
    .logo-img { width: 100%; height: 100%; object-fit: cover; }
    .logo-initials { font-size: 28px; color: #fff; font-weight: 700; }
    .logo-label { font-weight: 500; font-size: 13px; margin-bottom: 6px; }
    .logo-hint { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 500; }
    .form-input { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; color: var(--text); background: #fff; width: 100%; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(4,120,87,.1); }
    textarea.form-input { resize: vertical; }
    select.form-input { cursor: pointer; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .req { color: var(--danger); }

    .actions { text-align: right; }

    .link-row { display: flex; gap: 8px; align-items: center; }
    .link-display { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; font-size: 13px; color: var(--text-muted); }
    .link-display strong { color: var(--text); }
    .link-hint { font-size: 12px; color: var(--text-muted); }

    .icon-btn { width: 36px; height: 36px; border: 1px solid var(--border); background: #fff; border-radius: var(--radius); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); transition: background 0.15s; flex-shrink: 0; }
    .icon-btn:hover { background: var(--surface); }

    .status-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--surface); border-radius: var(--radius); }
    .status-label { font-weight: 500; font-size: 14px; }
    .status-hint { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .status-indicator { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-dot--open { background: #10B981; }
    .status-dot--closed { background: var(--danger); }

    .social-row { display: flex; gap: 8px; align-items: center; }
    .social-row .form-input { flex: 1; }

    .toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #CBD5E1; border-radius: 24px; transition: .3s; }
    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
    input:checked + .slider { background: var(--primary); }
    input:checked + .slider:before { transform: translateX(20px); }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: background 0.15s; }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn--ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn--ghost:hover { background: var(--surface); }
    .btn--sm { padding: 6px 12px; font-size: 13px; }

    @media (max-width: 900px) {
      .info-layout { grid-template-columns: 1fr; }
    }
  `],
})
export class StoreInfoTabComponent implements OnInit {
  info      = input.required<StoreInfo>();
  isSaving  = input<boolean>(false);
  save      = output<StoreInfo>();
  toggleOpen = output<void>();

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name:        [''],
    description: [''],
    category:    [''],
    phone:       [''],
    address:     [''],
    logoUrl:     [''],
    storeSlug:   [''],
    isOpen:      [true],
    whatsapp:    [''],
    instagram:   [''],
    facebook:    [''],
  });

  ngOnInit(): void {
    this.form.patchValue(this.info());
  }

  initial(): string {
    const name = this.form.value.name ?? '';
    return name.charAt(0).toUpperCase() || 'T';
  }

  onLogoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    this.form.patchValue({ logoUrl: url });
  }

  copyLink(): void {
    const slug = this.form.value.storeSlug ?? '';
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    navigator.clipboard?.writeText(`tiendi.pe/${slug}`).catch(() => {});
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.save.emit(this.form.getRawValue() as StoreInfo);
    }
  }
}
