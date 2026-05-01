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
  template: `
    <div class="schedule-wrap">
      <div class="card">
        <div class="card__header"><h3>Horario de atención</h3></div>
        <div class="card__body">
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div formArrayName="days">
              @for (day of daysArray.controls; track $index; let i = $index) {
                <div [formGroupName]="i" class="schedule-row" [class.schedule-row--disabled]="!day.get('enabled')?.value">
                  <label class="toggle">
                    <input type="checkbox" formControlName="enabled">
                    <span class="slider"></span>
                  </label>
                  <span class="day-name">{{ schedule()[$index].day }}</span>
                  <input type="time" class="time-input" formControlName="from">
                  <span class="sep">—</span>
                  <input type="time" class="time-input" formControlName="to">
                </div>
              }
            </div>
            <div class="actions">
              <button type="submit" class="btn btn--primary" [disabled]="isSaving()">
                @if (isSaving()) { Guardando... } @else { Guardar horarios }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .schedule-wrap { max-width: 600px; }

    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .card__header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .card__header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .card__body { padding: 20px; }

    .schedule-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      transition: opacity 0.2s;
    }
    .schedule-row:last-of-type { border-bottom: none; }

    .schedule-row--disabled .time-input { pointer-events: none; opacity: 0.4; }

    .day-name { width: 90px; font-size: 13px; font-weight: 500; flex-shrink: 0; }

    .time-input {
      width: 110px;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 13px;
      color: var(--text);
      background: #fff;
      box-sizing: border-box;
    }
    .time-input:focus { outline: none; border-color: var(--primary); }

    .sep { color: var(--text-muted); font-size: 13px; flex-shrink: 0; }

    .actions { margin-top: 20px; text-align: right; }

    .toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #CBD5E1; border-radius: 24px; transition: .3s; }
    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
    input:checked + .slider { background: var(--primary); }
    input:checked + .slider:before { transform: translateX(20px); }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
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
