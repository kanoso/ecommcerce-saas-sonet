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
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.scss',
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
