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
  templateUrl: './store-payments-tab.component.html',
  styleUrl: './store-payments-tab.component.scss',
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
