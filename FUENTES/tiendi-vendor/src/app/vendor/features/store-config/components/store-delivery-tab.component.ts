import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StoreDelivery } from '../store-config.store';

@Component({
  selector: 'app-store-delivery-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './store-delivery-tab.component.html',
  styleUrl: './store-delivery-tab.component.scss',
})
export class StoreDeliveryTabComponent implements OnInit {
  delivery  = input.required<StoreDelivery>();
  isSaving  = input<boolean>(false);
  save      = output<StoreDelivery>();

  private readonly fb = inject(FormBuilder);

  radiusDisplay = signal(5);

  form = this.fb.nonNullable.group({
    active:        [false],
    cost:          [5],
    freeMinimum:   [50],
    radius:        [5],
    estimatedTime: ['30-45 minutos'],
  });

  ngOnInit(): void {
    const d = this.delivery();
    this.form.patchValue(d);
    this.radiusDisplay.set(d.radius);
  }

  onSubmit(): void {
    this.save.emit(this.form.getRawValue() as StoreDelivery);
  }
}
