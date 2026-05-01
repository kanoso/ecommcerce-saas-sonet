import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OnboardingStore } from '../onboarding.store';
import { OnboardingStepperComponent } from '../components/onboarding-stepper.component';
import { OnboardingStep1Component } from '../components/onboarding-step1.component';
import { OnboardingStep2Component } from '../components/onboarding-step2.component';
import { OnboardingStep3Component } from '../components/onboarding-step3.component';
import { OnboardingStep4Component } from '../components/onboarding-step4.component';

const STEP_META = [
  { title: 'Datos de tu tienda', subtitle: 'Completá la información básica de tu negocio' },
  { title: 'Tu primer producto', subtitle: 'Agregá un producto para empezar tu catálogo' },
  { title: 'Horarios y Delivery', subtitle: 'Configurá cuándo y cómo entregás pedidos' },
  { title: 'Métodos de pago', subtitle: 'Elegí cómo querés recibir pagos' },
];

@Component({
  selector: 'app-setup-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    OnboardingStepperComponent,
    OnboardingStep1Component,
    OnboardingStep2Component,
    OnboardingStep3Component,
    OnboardingStep4Component,
  ],
  template: `
    <div class="setup">
      <header class="setup__header">
        <span class="setup__logo-icon">🛍️</span>
        <span class="setup__logo-text">Tiendi</span>
      </header>

      <main class="setup__main">
        <div class="setup__card">
          <app-onboarding-stepper [currentStep]="store.currentStep()" />

          <p class="setup__step-label">Paso {{ store.currentStep() }} de 4</p>
          <h1 class="setup__title">{{ stepMeta.title }}</h1>
          <p class="setup__subtitle">{{ stepMeta.subtitle }}</p>

          <div class="setup__step-body">
            @switch (store.currentStep()) {
              @case (1) {
                <app-onboarding-step1
                  [data]="store.storeData()"
                  (dataChange)="store.patchStoreData($event)"
                  (next)="store.nextStep()"
                  (skip)="store.skipStep()" />
              }
              @case (2) {
                <app-onboarding-step2
                  [data]="store.productData()"
                  (dataChange)="store.patchProductData($event)"
                  (next)="store.nextStep()"
                  (prev)="store.prevStep()"
                  (skip)="store.skipStep()" />
              }
              @case (3) {
                <app-onboarding-step3
                  [data]="store.scheduleData()"
                  (dataChange)="store.patchScheduleData($event)"
                  (next)="store.nextStep()"
                  (prev)="store.prevStep()"
                  (skip)="store.skipStep()" />
              }
              @case (4) {
                <app-onboarding-step4
                  [data]="store.paymentData()"
                  [isSaving]="store.isSaving()"
                  (dataChange)="store.patchPaymentData($event)"
                  (completed)="onFinish()"
                  (prev)="store.prevStep()" />
              }
            }
          </div>
        </div>
      </main>

      <footer class="setup__footer">
        <span>¿Ya tenés cuenta?</span>
        <a routerLink="/vendor/dashboard" class="setup__footer-link">Ir al panel →</a>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--surface);
    }

    .setup {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
    }

    .setup__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .setup__logo-icon {
      font-size: 28px;
    }

    .setup__logo-text {
      font-size: 22px;
      font-weight: 700;
      color: var(--primary);
    }

    .setup__main {
      width: 100%;
      max-width: 600px;
      flex: 1;
    }

    .setup__card {
      background: var(--card);
      border-radius: var(--radius-lg);
      padding: 32px 36px;
      box-shadow: var(--shadow-md);
    }

    .setup__step-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 4px;
    }

    .setup__title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .setup__subtitle {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0 0 24px;
    }

    .setup__step-body {
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }

    .setup__footer {
      margin-top: 24px;
      font-size: 13px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .setup__footer-link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }

    .setup__footer-link:hover {
      text-decoration: underline;
    }

    @media (max-width: 640px) {
      .setup__card {
        padding: 24px 20px;
      }
    }
  `],
})
export class SetupPage {
  readonly store = inject(OnboardingStore);

  get stepMeta() {
    return STEP_META[this.store.currentStep() - 1];
  }

  onFinish(): void {
    void this.store.saveAndFinish();
  }
}
