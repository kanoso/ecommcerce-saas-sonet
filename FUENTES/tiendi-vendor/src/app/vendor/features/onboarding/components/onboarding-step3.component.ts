import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ScheduleData } from '../onboarding.store';
import { OnboardingNavComponent } from './onboarding-nav.component';

@Component({
  selector: 'app-onboarding-step3',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, OnboardingNavComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="onNext()" class="step">
      <div class="step__section">
        <div class="step__toggle-row">
          <span class="step__toggle-label">Ofrezco delivery</span>
          <label class="toggle">
            <input type="checkbox" formControlName="hasDelivery" />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="step__section">
        <p class="step__section-title">Horarios de atención</p>

        <div class="step__schedule-row">
          <span class="step__schedule-day">Lun – Vie</span>
          <div class="step__time-pair">
            <input type="time" formControlName="weekdayOpen" class="step__time-input" />
            <span class="step__time-sep">–</span>
            <input type="time" formControlName="weekdayClose" class="step__time-input" />
          </div>
        </div>

        <div class="step__schedule-row">
          <span class="step__schedule-day">Sábado</span>
          <div class="step__time-pair">
            <input type="time" formControlName="saturdayOpen" class="step__time-input" />
            <span class="step__time-sep">–</span>
            <input type="time" formControlName="saturdayClose" class="step__time-input" />
          </div>
        </div>

        <div class="step__schedule-row">
          <div class="step__sunday-label">
            <span class="step__schedule-day">Domingo</span>
            <label class="toggle toggle--sm">
              <input type="checkbox" formControlName="sundayEnabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="step__time-pair">
            <input
              type="time"
              formControlName="sundayOpen"
              class="step__time-input"
              [class.step__time-input--disabled]="!form.get('sundayEnabled')?.value" />
            <span class="step__time-sep">–</span>
            <input
              type="time"
              formControlName="sundayClose"
              class="step__time-input"
              [class.step__time-input--disabled]="!form.get('sundayEnabled')?.value" />
          </div>
        </div>
      </div>

      @if (form.get('hasDelivery')?.value) {
        <div class="step__section step__delivery">
          <p class="step__section-title">Opciones de delivery</p>

          <div class="step__field">
            <div class="step__slider-label">
              Radio de cobertura:
              <strong style="color: var(--primary)">{{ form.get('deliveryRadiusKm')?.value }} km</strong>
            </div>
            <input
              type="range"
              formControlName="deliveryRadiusKm"
              class="step__slider"
              min="1"
              max="20"
              step="1" />
            <div class="step__slider-ticks">
              <span>1 km</span>
              <span>20 km</span>
            </div>
          </div>

          <div class="step__field">
            <label class="step__label" for="deliveryCost">Costo de envío (S/)</label>
            <div class="step__input-wrap">
              <span class="step__prefix">S/</span>
              <input
                id="deliveryCost"
                type="number"
                formControlName="deliveryCost"
                class="step__input step__input--prefixed"
                min="0"
                step="0.50" />
            </div>
          </div>
        </div>
      }

      <app-onboarding-nav
        [step]="3"
        (next)="onNext()"
        (prev)="prev.emit()"
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

    .step__section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .step__section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .step__toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .step__toggle-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .step__schedule-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .step__schedule-day {
      font-size: 13px;
      color: var(--text-primary);
      min-width: 64px;
    }

    .step__sunday-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .step__time-pair {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .step__time-sep {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .step__time-input {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 6px 8px;
      font-size: 13px;
      color: var(--text-primary);
      background: var(--card);
      outline: none;
      transition: border-color 0.2s;
      width: 90px;
    }

    .step__time-input:focus {
      border-color: var(--primary);
    }

    .step__time-input--disabled {
      opacity: 0.4;
      pointer-events: none;
    }

    .step__delivery {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 14px;
    }

    .step__field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .step__slider-label {
      font-size: 13px;
      color: var(--text-primary);
    }

    .step__slider {
      width: 100%;
      accent-color: var(--primary);
      cursor: pointer;
    }

    .step__slider-ticks {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-secondary);
    }

    .step__label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
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

    .step__input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .step__prefix {
      position: absolute;
      left: 10px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      pointer-events: none;
    }

    .step__input--prefixed {
      padding-left: 32px;
    }

    /* Toggle CSS */
    .toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
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

    .toggle--sm {
      width: 36px;
      height: 20px;
    }

    .toggle--sm .slider::before {
      height: 14px;
      width: 14px;
    }

    .toggle--sm input:checked + .slider::before {
      transform: translateX(16px);
    }
  `],
})
export class OnboardingStep3Component implements OnInit {
  data = input.required<ScheduleData>();
  dataChange = output<Partial<ScheduleData>>();
  next = output<void>();
  prev = output<void>();
  skip = output<void>();

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    hasDelivery: [true],
    weekdayOpen: ['08:00'],
    weekdayClose: ['22:00'],
    saturdayOpen: ['08:00'],
    saturdayClose: ['20:00'],
    sundayEnabled: [false],
    sundayOpen: ['09:00'],
    sundayClose: ['18:00'],
    deliveryRadiusKm: [5],
    deliveryCost: [5],
  });

  ngOnInit(): void {
    const d = this.data();
    this.form.patchValue({
      hasDelivery: d.hasDelivery,
      weekdayOpen: d.weekdayOpen,
      weekdayClose: d.weekdayClose,
      saturdayOpen: d.saturdayOpen,
      saturdayClose: d.saturdayClose,
      sundayEnabled: d.sundayEnabled,
      deliveryRadiusKm: d.deliveryRadiusKm,
      deliveryCost: d.deliveryCost,
    });
  }

  onNext(): void {
    const v = this.form.value;
    this.dataChange.emit({
      hasDelivery: v.hasDelivery ?? true,
      weekdayOpen: v.weekdayOpen ?? '08:00',
      weekdayClose: v.weekdayClose ?? '22:00',
      saturdayOpen: v.saturdayOpen ?? '08:00',
      saturdayClose: v.saturdayClose ?? '20:00',
      sundayEnabled: v.sundayEnabled ?? false,
      deliveryRadiusKm: v.deliveryRadiusKm ?? 5,
      deliveryCost: v.deliveryCost ?? 5,
    });
    this.next.emit();
  }
}
