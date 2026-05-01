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
  template: `
    <form [formGroup]="form" (ngSubmit)="onFinish()" class="step">
      <div class="step__methods">
        @for (method of paymentMethods; track method.key) {
          <label class="step__method-card"
            [class.step__method-card--active]="form.get(method.key)?.value">
            <div class="step__method-info">
              <span class="material-icons-outlined step__method-icon"
                [style.color]="method.color">
                {{ method.icon }}
              </span>
              <span class="step__method-label">{{ method.label }}</span>
            </div>
            <label class="toggle">
              <input type="checkbox" [formControlName]="method.key" />
              <span class="slider"></span>
            </label>
          </label>
        }
      </div>

      <div class="step__checklist">
        <p class="step__checklist-title">¡Ya casi estás listo!</p>
        @for (item of checklistItems; track item.label) {
          <div class="step__checklist-item">
            <span>{{ item.done ? '✅' : '⬜' }}</span>
            <span [class.step__checklist-done]="item.done">{{ item.label }}</span>
          </div>
        }
      </div>

      <app-onboarding-nav
        [step]="4"
        [isLastStep]="true"
        [isSaving]="isSaving()"
        (next)="onFinish()"
        (prev)="prev.emit()" />
    </form>
  `,
  styles: [`
    :host { display: block; }

    .step {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .step__methods {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .step__method-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--surface);
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: border-color 0.2s;
    }

    .step__method-card--active {
      border-color: var(--primary-light);
    }

    .step__method-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .step__method-icon {
      font-size: 22px;
    }

    .step__method-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .step__checklist {
      background: #D1FAE5;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .step__checklist-title {
      font-size: 13px;
      font-weight: 600;
      color: #065F46;
      margin: 0 0 6px;
    }

    .step__checklist-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-primary);
    }

    .step__checklist-done {
      color: #065F46;
    }

    /* Toggle CSS */
    .toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      inset: 0;
      background: #CBD5E1;
      border-radius: 12px;
      transition: 0.3s;
      cursor: pointer;
    }

    .slider::before {
      content: '';
      position: absolute;
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }

    .toggle input:checked + .slider {
      background: var(--primary);
    }

    .toggle input:checked + .slider::before {
      transform: translateX(20px);
    }
  `],
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
