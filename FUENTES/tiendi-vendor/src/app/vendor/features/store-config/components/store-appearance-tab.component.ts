import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StoreAppearance } from '../store-config.store';

@Component({
  selector: 'app-store-appearance-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="appearance-layout">

      <!-- Editor -->
      <div class="card">
        <div class="card__header"><h3>Colores y tema</h3></div>
        <div class="card__body">
          <form [formGroup]="form" (ngSubmit)="onSubmit()">

            <div class="form-group">
              <label class="form-label" for="appearance-primary-color">Color principal</label>
              <div class="color-row">
                <input
                  id="appearance-primary-color"
                  type="color"
                  class="color-picker"
                  formControlName="primaryColor"
                  (input)="syncColorText($event)"
                >
                <input
                  type="text"
                  class="form-input color-text"
                  formControlName="primaryColor"
                  maxlength="7"
                >
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="appearance-banner-drop">Banner de la tienda</label>
              <div
                id="appearance-banner-drop"
                class="drop-zone"
                [class.drop-zone--over]="dragOver()"
                (dragover)="onDragOver($event)"
                (dragleave)="dragOver.set(false)"
                (drop)="onDrop($event)"
                (click)="bannerInput.click()"
                (keydown.enter)="bannerInput.click()"
                (keydown.space)="bannerInput.click()"
                role="button"
                tabindex="0"
                aria-label="Subir banner de la tienda"
              >
                @if (form.value.bannerUrl) {
                  <img [src]="form.value.bannerUrl" alt="Banner" class="banner-preview">
                } @else {
                  <span class="material-icons-outlined" style="font-size:28px;color:var(--text-muted)">image</span>
                  <div class="drop-hint">Arrastrá o hacé clic para subir banner (1200×300px)</div>
                }
              </div>
              <input #bannerInput type="file" accept="image/*" style="display:none" (change)="onBannerChange($event)">
            </div>

            <div class="form-group">
              <label class="form-label" for="appearance-welcome">Mensaje de bienvenida</label>
              <input id="appearance-welcome" type="text" class="form-input" placeholder="¡Bienvenido a nuestra tienda!" formControlName="welcomeMessage">
            </div>

            <div class="actions">
              <button type="submit" class="btn btn--primary" [disabled]="isSaving()">
                @if (isSaving()) { Guardando... } @else { Guardar apariencia }
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Preview -->
      <div class="card">
        <div class="card__header"><h3>Vista previa de la tienda</h3></div>
        <div class="card__body">
          <div class="preview-frame">
            <div
              class="preview-header"
              [style.background]="'linear-gradient(135deg,' + (form.value.primaryColor || '#047857') + ',' + adjustColor(form.value.primaryColor || '#047857') + ')'"
            >
              {{ storeName() || 'Mi Tienda' }}
            </div>
            <div class="preview-body">
              @if (form.value.welcomeMessage) {
                <div class="preview-welcome">{{ form.value.welcomeMessage }}</div>
              }
              <div class="preview-label">Productos destacados</div>
              <div class="preview-grid">
                <div class="preview-card">
                  <div class="preview-emoji">🥛</div>
                  <div class="preview-name">Leche Gloria</div>
                  <div class="preview-price" [style.color]="form.value.primaryColor || '#047857'">S/ 4.50</div>
                </div>
                <div class="preview-card">
                  <div class="preview-emoji">🍚</div>
                  <div class="preview-name">Arroz 1kg</div>
                  <div class="preview-price" [style.color]="form.value.primaryColor || '#047857'">S/ 3.20</div>
                </div>
                <div class="preview-card">
                  <div class="preview-emoji">🥤</div>
                  <div class="preview-name">Inca Kola 1.5L</div>
                  <div class="preview-price" [style.color]="form.value.primaryColor || '#047857'">S/ 5.50</div>
                </div>
              </div>
            </div>
          </div>
          <p class="preview-caption">Vista previa del catálogo público</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .appearance-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }

    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .card__header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .card__header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .card__body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 500; }
    .form-input { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; color: var(--text); background: #fff; width: 100%; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: var(--primary); }

    .color-row { display: flex; gap: 8px; align-items: center; }
    .color-picker { width: 48px; height: 38px; border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; padding: 2px; flex-shrink: 0; }
    .color-text { width: 120px; flex-shrink: 0; }

    .drop-zone {
      border: 2px dashed var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      text-align: center;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-height: 90px;
      justify-content: center;
      transition: border-color 0.15s, background 0.15s;
    }
    .drop-zone:hover, .drop-zone--over { border-color: var(--primary); background: rgba(4,120,87,.04); }
    .drop-hint { font-size: 12px; color: var(--text-muted); }
    .banner-preview { max-width: 100%; border-radius: var(--radius); object-fit: cover; max-height: 80px; }

    .actions { text-align: right; }

    .preview-frame { border: 2px solid var(--border); border-radius: 10px; overflow: hidden; font-size: 12px; }
    .preview-header { height: 56px; display: flex; align-items: center; padding: 0 16px; color: #fff; font-weight: 700; font-size: 15px; }
    .preview-body { padding: 12px; background: #F9FAFB; }
    .preview-welcome { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; font-style: italic; }
    .preview-label { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; }
    .preview-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
    .preview-card { background: #fff; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid var(--border); }
    .preview-emoji { font-size: 20px; margin-bottom: 4px; }
    .preview-name { font-size: 10px; font-weight: 500; }
    .preview-price { font-size: 10px; font-weight: 600; margin-top: 2px; }
    .preview-caption { font-size: 12px; color: var(--text-muted); text-align: center; margin: 8px 0 0; }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 900px) {
      .appearance-layout { grid-template-columns: 1fr; }
    }
  `],
})
export class StoreAppearanceTabComponent implements OnInit {
  appearance = input.required<StoreAppearance>();
  storeName  = input<string>('');
  isSaving   = input<boolean>(false);
  save       = output<StoreAppearance>();

  protected readonly dragOver = signal(false);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    primaryColor:   ['#047857'],
    bannerUrl:      [''],
    welcomeMessage: [''],
  });

  ngOnInit(): void {
    this.form.patchValue(this.appearance());
  }

  syncColorText(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.form.patchValue({ primaryColor: color });
  }

  adjustColor(hex: string): string {
    try {
      const n = parseInt(hex.replace('#', ''), 16);
      const r = Math.max(0, (n >> 16) - 20);
      const g = Math.max(0, ((n >> 8) & 0xff) - 20);
      const b = Math.max(0, (n & 0xff) - 20);
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    } catch { return hex; }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.form.patchValue({ bannerUrl: URL.createObjectURL(file) });
    }
  }

  onBannerChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.form.patchValue({ bannerUrl: URL.createObjectURL(file) });
    }
  }

  onSubmit(): void {
    this.save.emit(this.form.getRawValue() as StoreAppearance);
  }
}
