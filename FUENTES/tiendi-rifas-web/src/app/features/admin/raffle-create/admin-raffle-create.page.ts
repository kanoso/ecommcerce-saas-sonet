import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../../core/api/admin-api';
import { WinnerExclusionMode } from '../../../core/api/api.models';
import { ExclusionModeFieldComponent } from '../shared/exclusion-mode-field.component';
import {
  PrizeDraft,
  PrizeListEditorComponent,
  emptyPrize,
  prizesComplete,
  toPrizeRequests,
} from '../shared/prize-list-editor.component';

function rangeValidator(control: AbstractControl): ValidationErrors | null {
  const min = control.get('numero_min')?.value;
  const max = control.get('numero_max')?.value;
  if (min !== null && max !== null && Number(max) <= Number(min)) {
    return { invalidRange: true };
  }
  return null;
}

@Component({
  selector: 'app-admin-raffle-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    PrizeListEditorComponent,
    ExclusionModeFieldComponent,
  ],
  templateUrl: './admin-raffle-create.page.html',
  styleUrl: './admin-raffle-create.page.scss',
})
export class AdminRaffleCreatePage {
  private readonly fb = inject(FormBuilder);
  private readonly adminApi = inject(AdminApi);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Ordered prizes; prize 1 is drawn first. */
  readonly prizes = signal<PrizeDraft[]>([emptyPrize()]);
  readonly exclusionMode = signal<WinnerExclusionMode>('TICKET_ONLY');
  readonly prizesError = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      titulo: ['', [Validators.required, Validators.maxLength(200)]],
      precio_boleto: [10, [Validators.required, Validators.min(0.01)]],
      numero_min: [1, [Validators.required, Validators.min(0)]],
      numero_max: [100, [Validators.required, Validators.min(1)]],
      intento_ganador: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
      efecto_sorteo: ['SLOT_MACHINE', [Validators.required]],
      modalidad_sorteo: ['AUTOMATIC', [Validators.required]],
      duracion_efecto_seg: [4, [Validators.required, Validators.min(1), Validators.max(60)]],
      velocidad_efecto: ['NORMAL', [Validators.required]],
    },
    { validators: [rangeValidator] },
  );

  onSubmit(): void {
    const prizesOk = prizesComplete(this.prizes());
    this.prizesError.set(prizesOk ? null : 'Cada premio necesita un título.');
    if (this.form.invalid || !prizesOk) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const val = this.form.getRawValue();
    this.adminApi
      .createRaffle({
        titulo: val.titulo!.trim(),
        precio_boleto: Number(val.precio_boleto),
        numero_min: Number(val.numero_min),
        numero_max: Number(val.numero_max),
        intento_ganador: Number(val.intento_ganador || 1),
        efecto_sorteo: val.efecto_sorteo || 'SLOT_MACHINE',
        modalidad_sorteo: val.modalidad_sorteo || 'AUTOMATIC',
        duracion_efecto_seg: Number(val.duracion_efecto_seg || 4),
        velocidad_efecto: val.velocidad_efecto || 'NORMAL',
        premios: toPrizeRequests(this.prizes()),
        modo_exclusion_ganador: this.exclusionMode(),
      })
      .subscribe({
        next: (created) => {
          this.loading.set(false);
          this.router.navigate(['/admin/rifas', created.raffleId]);
        },
        error: () => {
          this.error.set('No se pudo crear la rifa. Verifica los datos e intenta nuevamente.');
          this.loading.set(false);
        },
      });
  }
}
