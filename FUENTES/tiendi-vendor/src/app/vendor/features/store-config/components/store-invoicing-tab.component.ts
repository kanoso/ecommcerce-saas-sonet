import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StoreInvoicing } from '../store-config.store';

@Component({
  selector: 'app-store-invoicing-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="invoicing-wrap">
      <div class="card">
        <div class="card__header">
          <h3>Facturación Electrónica (SUNAT)</h3>
          <span class="warning-tag">⚠ Requerido para emitir comprobantes</span>
        </div>
        <div class="card__body">

          <div class="info-banner">
            <span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">info</span>
            Integrá con un proveedor OSE (como <strong>Nubefact</strong> o <strong>Efact</strong>) para emitir boletas y facturas electrónicas automáticamente.
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="inv-ruc">RUC <span class="req">*</span></label>
                <input id="inv-ruc" type="text" class="form-input" placeholder="20XXXXXXXXX" maxlength="11" formControlName="ruc">
              </div>
              <div class="form-group">
                <label class="form-label" for="inv-regime">Régimen tributario</label>
                <select id="inv-regime" class="form-input" formControlName="regime">
                  <option value="RUS">RUS</option>
                  <option value="RER">Régimen Especial</option>
                  <option value="RMT">MYPE Tributario</option>
                  <option value="RGE">Régimen General</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="inv-business-name">Razón Social <span class="req">*</span></label>
              <input id="inv-business-name" type="text" class="form-input" placeholder="Ej: Bodega Don Carlos E.I.R.L." formControlName="businessName">
            </div>

            <div class="form-group">
              <label class="form-label" for="inv-fiscal-address">Dirección fiscal</label>
              <input id="inv-fiscal-address" type="text" class="form-input" placeholder="Ej: Jr. Tarapacá 340, Barranco, Lima" formControlName="fiscalAddress">
            </div>

            <div class="form-group">
              <label class="form-label" for="inv-ose-token">Token API del proveedor OSE</label>
              <div class="password-row">
                <input
                  id="inv-ose-token"
                  [type]="showToken() ? 'text' : 'password'"
                  class="form-input"
                  placeholder="Token de Nubefact / Efact / etc."
                  formControlName="oseToken"
                >
                <button type="button" class="icon-btn" (click)="showToken.set(!showToken())">
                  <span class="material-icons-outlined" style="font-size:18px">
                    {{ showToken() ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
              <div class="form-hint">Obtenelo en el panel de tu proveedor OSE. Se guarda encriptado.</div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="inv-boleta-series">Serie boletas</label>
                <input id="inv-boleta-series" type="text" class="form-input" formControlName="boletaSeries">
              </div>
              <div class="form-group">
                <label class="form-label" for="inv-factura-series">Serie facturas</label>
                <input id="inv-factura-series" type="text" class="form-input" formControlName="facturaSeries">
              </div>
            </div>

            <div class="toggle-row">
              <div>
                <div class="toggle-label">Emitir comprobante automáticamente</div>
                <div class="toggle-hint">Al marcar un pedido como "Entregado"</div>
              </div>
              <label class="toggle">
                <input type="checkbox" formControlName="autoEmit">
                <span class="slider"></span>
              </label>
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
    .invoicing-wrap { max-width: 640px; }

    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .card__header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .card__header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .card__body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

    .warning-tag { background: #FEF3C7; color: #92400E; font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 500; }

    .info-banner { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius); padding: 12px 14px; font-size: 13px; color: #1E40AF; }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 500; }
    .form-hint { font-size: 12px; color: var(--text-muted); }
    .form-input { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; color: var(--text); background: #fff; width: 100%; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: var(--primary); }
    select.form-input { cursor: pointer; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .req { color: var(--danger); }

    .password-row { display: flex; gap: 8px; }
    .password-row .form-input { flex: 1; }

    .icon-btn { width: 38px; height: 38px; border: 1px solid var(--border); background: #fff; border-radius: var(--radius); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); flex-shrink: 0; }
    .icon-btn:hover { background: var(--surface); }

    .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--surface); border-radius: var(--radius); }
    .toggle-label { font-weight: 500; font-size: 14px; }
    .toggle-hint { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .actions { text-align: right; }

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
export class StoreInvoicingTabComponent implements OnInit {
  invoicing = input.required<StoreInvoicing>();
  isSaving  = input<boolean>(false);
  save      = output<StoreInvoicing>();

  protected readonly showToken = signal(false);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    ruc:           [''],
    regime:        ['RUS'],
    businessName:  [''],
    fiscalAddress: [''],
    oseToken:      [''],
    boletaSeries:  ['B001'],
    facturaSeries: ['F001'],
    autoEmit:      [false],
  });

  ngOnInit(): void {
    this.form.patchValue(this.invoicing());
  }

  onSubmit(): void {
    this.save.emit(this.form.getRawValue() as StoreInvoicing);
  }
}
