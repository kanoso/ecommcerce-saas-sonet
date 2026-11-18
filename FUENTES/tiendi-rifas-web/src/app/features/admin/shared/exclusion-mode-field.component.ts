import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { WinnerExclusionMode } from '../../../core/api/api.models';

/**
 * How winners leave the pool between prizes. Editable in DRAFT and ACTIVE;
 * the close of sales freezes it, so the page passes `locked` from then on.
 */
@Component({
  selector: 'app-exclusion-mode-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .mode {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      border: none;
    }
    .mode__legend {
      font-size: 0.8125rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    .mode__option {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .mode__hint {
      display: block;
      font-size: 0.75rem;
      color: var(--slate, #64748b);
    }
    .mode__locked {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--slate, #64748b);
    }
  `,
  template: `
    <fieldset class="mode" [disabled]="locked()">
      <legend class="mode__legend">Exclusión entre premios</legend>
      <label class="mode__option">
        <input
          type="radio"
          name="modo_exclusion_ganador"
          value="TICKET_ONLY"
          [checked]="value() === 'TICKET_ONLY'"
          (change)="value.set('TICKET_ONLY')"
        />
        <span>
          Solo el boleto ganador
          <span class="mode__hint">El boleto que gana sale del sorteo; el resto de boletos de su comprador sigue participando.</span>
        </span>
      </label>
      <label class="mode__option">
        <input
          type="radio"
          name="modo_exclusion_ganador"
          value="BUYER"
          [checked]="value() === 'BUYER'"
          (change)="value.set('BUYER')"
        />
        <span>
          Por comprador
          <span class="mode__hint">Quien gana un premio sale del sorteo con todos sus boletos.</span>
        </span>
      </label>
      @if (locked()) {
        <span class="mode__locked">🔒 Bloqueado: se fijó al cierre de ventas.</span>
      }
    </fieldset>
  `,
})
export class ExclusionModeFieldComponent {
  readonly value = model<WinnerExclusionMode>('TICKET_ONLY');
  readonly locked = input(false);
}
