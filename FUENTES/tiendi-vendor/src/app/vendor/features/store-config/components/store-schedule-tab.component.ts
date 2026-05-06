import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { StoreScheduleDay } from '../store-config.store';

@Component({
  selector: 'app-store-schedule-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './store-schedule-tab.component.html',
  styleUrl: './store-schedule-tab.component.scss',
})
export class StoreScheduleTabComponent implements OnInit {
  schedule  = input.required<StoreScheduleDay[]>();
  isSaving  = input<boolean>(false);
  save      = output<StoreScheduleDay[]>();

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    days: this.fb.array<FormGroup>([]),
  });

  get daysArray(): FormArray { return this.form.get('days') as FormArray; }

  ngOnInit(): void {
    for (const day of this.schedule()) {
      this.daysArray.push(this.fb.nonNullable.group({
        enabled: [day.enabled],
        from:    [day.from],
        to:      [day.to],
      }));
    }
  }

  onSubmit(): void {
    const days = this.daysArray.value as { enabled: boolean; from: string; to: string }[];
    const result: StoreScheduleDay[] = this.schedule().map((d, i) => ({
      ...d,
      enabled: days[i].enabled,
      from:    days[i].from,
      to:      days[i].to,
    }));
    this.save.emit(result);
  }
}
