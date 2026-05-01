import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StorePayments } from '../store-config.store';

const PAYMENT_METHODS = [
  { key: 'cash',     label: 'Efectivo',              desc: 'Contra entrega o en tienda',      icon: 'account_balance_wallet', color: '#25D366' },
  { key: 'yape',     label: 'Yape',                  desc: 'Billetera digital',               icon: 'smartphone',             color: '#0055FF' },
  { key: 'plin',     label: 'Plin',                  desc: 'Billetera digital',               icon: 'smartphone',             color: '#00B4D8' },
  { key: 'transfer', label: 'Transferencia bancaria', desc: 'BCP, Interbank, etc.',           icon: 'account_balance',        color: '#6366F1' },
  { key: 'card',     label: 'Tarjeta crédito/débito', desc: 'Requiere integración Culqi/Stripe', icon: 'credit_card',        color: '#047857' },
];

@Component({
  selector: 'app-store-payments-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="payments-wrap">
      <div class="card">
        <div class="card__header"><h3>Métodos de pago aceptados</h3></div>
        <div class="card__body">
          <form [formGroup]="form" (ngSubmit)="onSubmit()">

            @for (method of methods; track method.key) {
              <div class="payment-row">
                <div class="payment-info">
                  <span class="material-icons-outlined" [style.color]="method.color" style="font-size:20px">{{ method.icon }}</span>
                  <div>
                    <div class="payment-label">{{ method.label }}</div>
                    <div class="payment-desc">{{ method.desc }}</div>
                  </div>
                </div>
                <label class="toggle">
                  <input type="checkbox" [formControlName]="method.key">
                  <span class="slider"></span>
                </label>
              </div>
            }

            <hr class="divider">

            @if (form.get('cash')?.value) {
              <div class="form-group">
                <label class="form-label" for="payments-cash-msg">Mensaje para pagos en efectivo</label>
                <textarea id="payments-cash-msg" class="form-input" rows="2" placeholder='Ej: "Tener cambio exacto por favor"' formControlName="cashMessage"></textarea>
              </div>
            }

            @if (form.get('transfer')?.value) {
              <div class="form-group">
                <label class="form-label" for="payments-transfer-data">Datos para transferencia bancaria</label>
                <textarea id="payments-transfer-data" class="form-input" rows="2" placeholder='Ej: "BCP cuenta 123-456-789 a nombre de..."' formControlName="transferData"></textarea>
              </div>
            }

            <div class="actions">
              <button type="submit" class="btn btn--primary" [disabled]="isSaving()">
                @if (isSaving()) { Guardando... } @else { Guardar }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .payments-wrap { max-width: 580px; }

    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .card__header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .card__header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .card__body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }

    .payment-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--surface); border-radius: var(--radius); }
    .payment-info { display: flex; align-items: center; gap: 10px; }
    .payment-label { font-size: 13px; font-weight: 500; }
    .payment-desc { font-size: 12px; color: var(--text-muted); margin-top: 1px; }

    .divider { border: none; border-top: 1px solid var(--border); margin: 4px 0; }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 500; }
    .form-input { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; color: var(--text); background: #fff; width: 100%; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: var(--primary); }
    textarea.form-input { resize: vertical; }

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
export class StorePaymentsTabComponent implements OnInit {
  payments  = input.required<StorePayments>();
  isSaving  = input<boolean>(false);
  save      = output<StorePayments>();

  protected readonly methods = PAYMENT_METHODS;
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    cash:         [false],
    yape:         [false],
    plin:         [false],
    transfer:     [false],
    card:         [false],
    cashMessage:  [''],
    transferData: [''],
  });

  ngOnInit(): void {
    this.form.patchValue(this.payments());
  }

  onSubmit(): void {
    this.save.emit(this.form.getRawValue() as StorePayments);
  }
}
