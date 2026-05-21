import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StoreInvoicing } from '../store-config.store';

@Component({
  selector: 'app-store-invoicing-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './store-invoicing-tab.component.html',
  styleUrl: './store-invoicing-tab.component.scss',
})
export class StoreInvoicingTabComponent implements OnInit {
  invoicing = input.required<StoreInvoicing>();
  isSaving  = input<boolean>(false);
  save      = output<StoreInvoicing>();

  protected readonly showToken = signal(false);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    ruc:           [''],
    regime:        ['RUS'],
    businessName:  [''],
    fiscalAddress: [''],
    oseToken:      [''],
    boletaSeries:  ['B001'],
    facturaSeries: ['F001'],
    autoEmit:      [false],
    igvEnabled:    [false],
  });

  ngOnInit(): void {
    this.form.patchValue(this.invoicing());
  }

  onSubmit(): void {
    this.save.emit(this.form.getRawValue() as StoreInvoicing);
  }
}
