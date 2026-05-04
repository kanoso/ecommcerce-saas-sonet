import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PaymentData } from '../onboarding.store';
import { OnboardingNavComponent } from './onboarding-nav.component';

interface PaymentMethod {
  key: keyof PaymentData;
  label: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-onboarding-step4',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, OnboardingNavComponent],
  templateUrl: './onboarding-step4.component.html',
  styleUrl: './onboarding-step4.component.scss',
})
export class OnboardingStep4Component implements OnInit {
  data = input.required<PaymentData>();
  isSaving = input<boolean>(false);
  dataChange = output<Partial<PaymentData>>();
  completed = output<void>();
  prev = output<void>();

  readonly paymentMethods: PaymentMethod[] = [
    { key: 'cash', label: 'Efectivo', icon: 'account_balance_wallet', color: '#25D366' },
    { key: 'yape', label: 'Yape', icon: 'smartphone', color: '#0055FF' },
    { key: 'plin', label: 'Plin', icon: 'smartphone', color: '#00B4D8' },
    { key: 'transfer', label: 'Transferencia bancaria', icon: 'account_balance', color: 'var(--secondary)' },
    { key: 'card', label: 'Tarjeta (Culqi)', icon: 'credit_card', color: 'var(--primary)' },
  ];

  get checklistItems() {
    const hasPayment = Object.values(this.form.value).some(Boolean);
    return [
      { label: 'Datos de la tienda configurados', done: true },
      { label: 'Primer producto agregado', done: true },
      { label: 'Horarios y delivery configurados', done: true },
      { label: 'Métodos de pago', done: hasPayment },
    ];
  }

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    cash: [true],
    yape: [true],
    plin: [false],
    transfer: [false],
    card: [false],
  });

  ngOnInit(): void {
    const d = this.data();
    this.form.patchValue(d);
  }

  onFinish(): void {
    this.dataChange.emit(this.form.value as Partial<PaymentData>);
    this.completed.emit();
  }
}
