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
  templateUrl: './sunat-config-tab.component.html',
  styleUrl: './sunat-config-tab.component.scss',
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
