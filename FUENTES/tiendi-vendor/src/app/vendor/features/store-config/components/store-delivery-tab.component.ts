import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StoreDelivery } from '../store-config.store';

@Component({
  selector: 'app-store-delivery-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="delivery-wrap">
      <div class="card">
        <div class="card__header"><h3>Configuración de delivery</h3></div>
        <div class="card__body">
          <form [formGroup]="form" (ngSubmit)="onSubmit()">

            <div class="toggle-row">
              <div>
                <div class="toggle-label">Delivery activo</div>
                <div class="toggle-hint">Permitir pedidos con entrega a domicilio</div>
              </div>
              <label class="toggle">
                <input type="checkbox" formControlName="active">
                <span class="slider"></span>
              </label>
            </div>

            <hr class="divider">

            <div class="form-group">
              <label class="form-label" for="delivery-cost">Costo de delivery</label>
              <div class="prefix-input">
                <span class="prefix">S/</span>
                <input id="delivery-cost" type="number" class="form-input" formControlName="cost" min="0" step="0.50">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="delivery-free-min">Mínimo para delivery gratis</label>
              <div class="prefix-input">
                <span class="prefix">S/</span>
                <input id="delivery-free-min" type="number" class="form-input" formControlName="freeMinimum" min="0" step="5">
              </div>
              <div class="form-hint">Dejar en 0 para nunca ofrecer delivery gratis</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="delivery-radius">Radio de entrega (km)</label>
              <input
                id="delivery-radius"
                type="range"
                class="range-input"
                formControlName="radius"
                min="1"
                max="20"
                (input)="radiusDisplay.set(+$any($event.target).value)"
              >
              <div class="range-value">{{ radiusDisplay() }} km</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="delivery-time">Tiempo estimado de entrega</label>
              <select id="delivery-time" class="form-input" formControlName="estimatedTime">
                <option>15-30 minutos</option>
                <option>30-45 minutos</option>
                <option>45-60 minutos</option>
                <option>1-2 horas</option>
              </select>
            </div>

            <div class="actions">
              <button type="submit" class="btn btn--primary" [disabled]="isSaving()">
                @if (isSaving()) { Guardando... } @else { Guardar configuración }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .delivery-wrap { max-width: 520px; }

    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .card__header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .card__header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .card__body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

    .toggle-row { display: flex; justify-content: space-between; align-items: center; }
    .toggle-label { font-weight: 500; font-size: 14px; }
    .toggle-hint { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .divider { border: none; border-top: 1px solid var(--border); }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 500; }
    .form-hint { font-size: 12px; color: var(--text-muted); }
    .form-input { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; color: var(--text); background: #fff; width: 100%; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: var(--primary); }
    select.form-input { cursor: pointer; }

    .prefix-input { position: relative; }
    .prefix { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px; pointer-events: none; }
    .prefix-input .form-input { padding-left: 32px; }

    .range-input { width: 100%; accent-color: var(--primary); }
    .range-value { font-size: 13px; font-weight: 600; color: var(--primary); }

    .actions { text-align: right; margin-top: 4px; }

    .toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #CBD5E1; border-radius: 24px; transition: .3s; }
    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
    input:checked + .slider { background: var(--primary); }
    input:checked + .slider:before { transform: translateX(20px); }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class StoreDeliveryTabComponent implements OnInit {
  delivery  = input.required<StoreDelivery>();
  isSaving  = input<boolean>(false);
  save      = output<StoreDelivery>();

  private readonly fb = inject(FormBuilder);

  radiusDisplay = signal(5);

  form = this.fb.nonNullable.group({
    active:        [false],
    cost:          [5],
    freeMinimum:   [50],
    radius:        [5],
    estimatedTime: ['30-45 minutos'],
  });

  ngOnInit(): void {
    const d = this.delivery();
    this.form.patchValue(d);
    this.radiusDisplay.set(d.radius);
  }

  onSubmit(): void {
    this.save.emit(this.form.getRawValue() as StoreDelivery);
  }
}
