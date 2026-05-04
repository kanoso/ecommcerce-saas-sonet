import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NotifSettings } from '../notifications.store';

@Component({
  selector: 'app-notification-settings-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './notification-settings-card.component.html',
  styleUrl: './notification-settings-card.component.scss',
})
export class NotificationSettingsCardComponent implements OnInit {
  settings  = input.required<NotifSettings>();
  isSaving  = input<boolean>(false);
  save      = output<NotifSettings>();

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    newOrder: this.fb.nonNullable.group({ inApp: [true], email: [true], whatsapp: [true] }),
    lowStock: this.fb.nonNullable.group({ inApp: [true], email: [true], whatsapp: [false] }),
    unattended: this.fb.nonNullable.group({ inApp: [true], email: [false], whatsapp: [true], thresholdMinutes: [30] }),
    planExpiring: this.fb.nonNullable.group({ inApp: [true], email: [true], whatsapp: [false], daysAhead: [7] }),
    stockAlertThreshold: [5],
  });

  ngOnInit(): void { this.form.patchValue(this.settings()); }

  onSubmit(): void {
    const v = this.form.getRawValue();
    this.save.emit({ ...this.settings(), ...v } as NotifSettings);
  }
}
