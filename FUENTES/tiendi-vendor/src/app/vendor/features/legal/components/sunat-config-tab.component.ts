import {
  ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

export interface SunatConfigValue {
  ruc: string;
  razonSocial: string;
  direccionFiscal: string;
  regimen: string;
  oseToken: string;
  seriesBoleta: string;
  seriesFactura: string;
  autoEmit: boolean;
}

@Component({
  selector: 'app-sunat-config-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <!-- Header con badge Plan Pro -->
    <div class="tab-header">
      <div>
        <h3 class="tab-header__title">Facturación Electrónica SUNAT</h3>
        <p class="tab-header__sub">Configurá tu operador de servicios electrónicos (OSE) para emitir comprobantes.</p>
      </div>
      <span class="badge-plan">
        <span class="material-icons-outlined" style="font-size:14px">workspace_premium</span>
        Plan Pro
      </span>
    </div>

    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="sunat-form">

      <!-- Datos empresa -->
      <fieldset class="form-section">
        <legend class="section-title">Datos de la empresa</legend>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="sunat-ruc">RUC <span class="req">*</span></label>
            <input id="sunat-ruc" class="form-input" type="text" formControlName="ruc"
              placeholder="20123456789" maxlength="11">
            @if (form.get('ruc')?.invalid && form.get('ruc')?.touched) {
              <span class="form-error">RUC de 11 dígitos requerido</span>
            }
          </div>
          <div class="form-group">
            <label class="form-label" for="sunat-razonSocial">Razón Social <span class="req">*</span></label>
            <input id="sunat-razonSocial" class="form-input" type="text" formControlName="razonSocial"
              placeholder="Mi Empresa S.A.C.">
          </div>
          <div class="form-group form-group--full">
            <label class="form-label" for="sunat-direccion">Dirección Fiscal</label>
            <input id="sunat-direccion" class="form-input" type="text" formControlName="direccionFiscal"
              placeholder="Av. Principal 123, Lima">
          </div>
          <div class="form-group">
            <label class="form-label" for="sunat-regimen">Régimen Tributario</label>
            <select id="sunat-regimen" class="form-input" formControlName="regimen">
              <option value="RUS">Nuevo RUS</option>
              <option value="RER">Régimen Especial</option>
              <option value="RMT">Régimen MYPE Tributario</option>
              <option value="RG">Régimen General</option>
            </select>
          </div>
        </div>
      </fieldset>

      <!-- Series de comprobantes -->
      <fieldset class="form-section">
        <legend class="section-title">Series de comprobantes</legend>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="sunat-seriesBoleta">Serie Boleta</label>
            <input id="sunat-seriesBoleta" class="form-input" type="text" formControlName="seriesBoleta"
              placeholder="B001">
          </div>
          <div class="form-group">
            <label class="form-label" for="sunat-seriesFactura">Serie Factura</label>
            <input id="sunat-seriesFactura" class="form-input" type="text" formControlName="seriesFactura"
              placeholder="F001">
          </div>
        </div>
      </fieldset>

      <!-- OSE Token -->
      <fieldset class="form-section">
        <legend class="section-title">Operador de Servicios Electrónicos (OSE)</legend>

        <div class="form-group">
          <label class="form-label" for="sunat-oseToken">Token OSE <span class="req">*</span></label>
          <div class="input-password">
            <input id="sunat-oseToken" class="form-input" [type]="showToken() ? 'text' : 'password'"
              formControlName="oseToken" placeholder="Token de acceso al OSE">
            <button type="button" class="toggle-pwd" (click)="showToken.set(!showToken())"
              [attr.aria-label]="showToken() ? 'Ocultar token' : 'Mostrar token'">
              <span class="material-icons-outlined">{{ showToken() ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>

        <div class="info-box">
          <span class="material-icons-outlined info-box__icon">lock</span>
          <span>Token encriptado con AES-256. Nunca se muestra en texto plano luego de guardado.</span>
        </div>
      </fieldset>

      <!-- Auto-emisión -->
      <fieldset class="form-section">
        <legend class="section-title">Automatización</legend>
        <div class="toggle-row">
          <div class="toggle-row__text">
            <span id="sunat-autoEmit-label" class="toggle-row__label">Emitir automáticamente al DELIVERED</span>
            <span class="toggle-row__hint">Genera boleta/factura cuando el pedido es marcado como entregado.</span>
          </div>
          <button type="button" class="toggle" [class.toggle--on]="form.get('autoEmit')?.value"
            (click)="toggleAutoEmit()"
            role="switch"
            [attr.aria-checked]="form.get('autoEmit')?.value"
            aria-labelledby="sunat-autoEmit-label">
            <div class="toggle__thumb"></div>
          </button>
        </div>
      </fieldset>

      <!-- Acciones -->
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" (click)="onCancel()">Cancelar</button>
        <button type="submit" class="btn btn--primary" [disabled]="isSaving()">
          @if (isSaving()) { Guardando... } @else { Guardar configuración }
        </button>
      </div>
    </form>
  `,
  styles: [`
    .tab-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
    }
    .tab-header__title { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
    .tab-header__sub   { font-size: 13px; color: var(--text-muted); margin: 0; }

    .badge-plan {
      display: inline-flex; align-items: center; gap: 4px;
      background: #EDE9FE; color: #5B21B6;
      padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600;
      white-space: nowrap;
    }

    .sunat-form { display: flex; flex-direction: column; gap: 24px; }

    .form-section {
      border: 1px solid var(--border); border-radius: var(--radius-lg);
      padding: 20px; margin: 0;
    }
    .section-title {
      font-size: 13px; font-weight: 600; color: var(--text); padding: 0 6px;
      float: none; /* reset fieldset legend default */
    }

    .form-grid {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 16px; margin-top: 16px;
    }
    .form-group--full { grid-column: 1 / -1; }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 500; }
    .req { color: var(--danger); }
    .form-error { font-size: 12px; color: var(--danger); }

    .form-input {
      padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius);
      font-size: 13px; background: #fff; color: var(--text); width: 100%;
      box-sizing: border-box;
    }
    .form-input:focus { outline: none; border-color: var(--primary); }
    select.form-input { cursor: pointer; }

    .input-password { position: relative; display: flex; }
    .input-password .form-input { padding-right: 42px; flex: 1; }
    .toggle-pwd {
      position: absolute; right: 0; top: 0; bottom: 0; width: 40px;
      border: none; background: transparent; cursor: pointer; color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
    }
    .toggle-pwd:hover { color: var(--text); }
    .toggle-pwd .material-icons-outlined { font-size: 18px; }

    .info-box {
      display: flex; align-items: flex-start; gap: 8px; margin-top: 12px;
      background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius);
      padding: 10px 12px; font-size: 12px; color: #1E40AF;
    }
    .info-box__icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

    .toggle-row {
      display: flex; justify-content: space-between; align-items: center; gap: 16px;
      cursor: pointer; margin-top: 12px;
    }
    .toggle-row__text { display: flex; flex-direction: column; gap: 2px; }
    .toggle-row__label { font-size: 13px; font-weight: 500; }
    .toggle-row__hint  { font-size: 12px; color: var(--text-muted); }

    .toggle {
      width: 44px; height: 24px; border-radius: 99px; background: #D1D5DB;
      position: relative; cursor: pointer; transition: background .2s; flex-shrink: 0;
    }
    .toggle--on { background: var(--primary); }
    .toggle__thumb {
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; border-radius: 50%; background: #fff;
      transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2);
    }
    .toggle--on .toggle__thumb { transform: translateX(20px); }

    .form-actions {
      display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px;
    }

    .btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 9px 20px;
      border-radius: var(--radius); font-size: 14px; font-weight: 500;
      cursor: pointer; border: none; transition: background .15s;
    }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: .6; cursor: not-allowed; }
    .btn--ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn--ghost:hover { background: var(--surface); }

    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
      .form-group--full { grid-column: 1; }
    }
  `],
})
export class SunatConfigTabComponent implements OnInit {
  readonly isSaving      = input(false);
  readonly initialConfig = input<Partial<SunatConfigValue>>({});

  readonly save      = output<SunatConfigValue>();
  readonly cancelled = output<void>();

  readonly showToken = signal(false);

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    ruc:             [''],
    razonSocial:     [''],
    direccionFiscal: [''],
    regimen:         ['RUS'],
    oseToken:        [''],
    seriesBoleta:    ['B001'],
    seriesFactura:   ['F001'],
    autoEmit:        [false],
  });

  ngOnInit(): void {
    const cfg = this.initialConfig();
    if (cfg && Object.keys(cfg).length) {
      this.form.patchValue(cfg);
    }
  }

  toggleAutoEmit(): void {
    const current = this.form.get('autoEmit')?.value ?? false;
    this.form.patchValue({ autoEmit: !current });
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.save.emit(this.form.getRawValue() as SunatConfigValue);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
