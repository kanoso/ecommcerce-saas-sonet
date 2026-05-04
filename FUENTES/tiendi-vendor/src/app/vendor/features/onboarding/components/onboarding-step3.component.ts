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
  templateUrl: './onboarding-step3.component.html',
  styleUrl: './onboarding-step3.component.scss',
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
