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
  template: `
    <div class="card">
      <div class="card__header"><h3>⚙ Configuración de alertas por canal</h3></div>
      <div class="card__body">
        <form [formGroup]="form" (ngSubmit)="onSubmit()">

          <!-- Nuevo pedido -->
          <div class="alert-row">
            <div class="alert-label">🛒 Nuevo pedido</div>
            <div class="channels" formGroupName="newOrder">
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="inApp" aria-label="Nuevo pedido por In-app"><span class="slider"></span></label><span aria-hidden="true">In-app</span></div>
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="email" aria-label="Nuevo pedido por Email"><span class="slider"></span></label><span aria-hidden="true">Email</span></div>
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="whatsapp" aria-label="Nuevo pedido por WhatsApp"><span class="slider"></span></label><span aria-hidden="true">WhatsApp</span></div>
            </div>
          </div>

          <!-- Stock bajo -->
          <div class="alert-row">
            <div>
              <div class="alert-label">⚠️ Stock bajo</div>
              <div class="alert-sub">
                Umbral:
                <input type="number" class="inline-input" formControlName="stockAlertThreshold" min="1" aria-label="Umbral de stock bajo en unidades">
                unidades
              </div>
            </div>
            <div class="channels" formGroupName="lowStock">
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="inApp" aria-label="Stock bajo por In-app"><span class="slider"></span></label><span aria-hidden="true">In-app</span></div>
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="email" aria-label="Stock bajo por Email"><span class="slider"></span></label><span aria-hidden="true">Email</span></div>
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="whatsapp" aria-label="Stock bajo por WhatsApp"><span class="slider"></span></label><span aria-hidden="true">WhatsApp</span></div>
            </div>
          </div>

          <!-- Pedido sin atender -->
          <div class="alert-row">
            <div>
              <div class="alert-label">⏰ Pedido sin atender</div>
              <div class="alert-sub" formGroupName="unattended">
                Recordatorio a los
                <input type="number" class="inline-input" formControlName="thresholdMinutes" min="5" aria-label="Minutos para recordatorio de pedido sin atender">
                min
              </div>
            </div>
            <div class="channels" formGroupName="unattended">
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="inApp" aria-label="Pedido sin atender por In-app"><span class="slider"></span></label><span aria-hidden="true">In-app</span></div>
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="email" aria-label="Pedido sin atender por Email"><span class="slider"></span></label><span aria-hidden="true">Email</span></div>
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="whatsapp" aria-label="Pedido sin atender por WhatsApp"><span class="slider"></span></label><span aria-hidden="true">WhatsApp</span></div>
            </div>
          </div>

          <!-- Plan por vencer -->
          <div class="alert-row">
            <div>
              <div class="alert-label">💳 Plan por vencer</div>
              <div class="alert-sub" formGroupName="planExpiring">
                Avisar con
                <input type="number" class="inline-input" formControlName="daysAhead" min="1" aria-label="Días de anticipación para alerta de plan por vencer">
                días de anticipación
              </div>
            </div>
            <div class="channels" formGroupName="planExpiring">
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="inApp" aria-label="Plan por vencer por In-app"><span class="slider"></span></label><span aria-hidden="true">In-app</span></div>
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="email" aria-label="Plan por vencer por Email"><span class="slider"></span></label><span aria-hidden="true">Email</span></div>
              <div class="channel"><label class="toggle"><input type="checkbox" formControlName="whatsapp" aria-label="Plan por vencer por WhatsApp"><span class="slider"></span></label><span aria-hidden="true">WhatsApp</span></div>
            </div>
          </div>

          <div class="card__footer">
            <button type="submit" class="btn btn--primary" [disabled]="isSaving()">
              <span class="material-icons-outlined" style="font-size:16px">save</span>
              @if (isSaving()) { Guardando... } @else { Guardar preferencias }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    .card__header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .card__header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .card__body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
    .card__footer { display: flex; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 16px; margin-top: 4px; }

    .alert-row { display: flex; flex-direction: column; gap: 8px; }
    .alert-label { font-size: 13px; font-weight: 600; }
    .alert-sub { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 2px; }

    .channels { display: flex; gap: 20px; flex-wrap: wrap; }
    .channel { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }

    .inline-input { width: 52px; padding: 3px 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; text-align: center; }
    .inline-input:focus { outline: none; border-color: var(--primary); }

    .toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #CBD5E1; border-radius: 20px; transition: .3s; }
    .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
    input:checked + .slider { background: var(--primary); }
    input:checked + .slider:before { transform: translateX(16px); }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
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
