import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'td-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <button
      type="button"
      [ngClass]="['chip', selected() ? 'chip-selected' : '', disabled() ? 'chip-disabled' : '']"
      [disabled]="disabled()"
      [attr.aria-pressed]="selected()"
      [attr.aria-disabled]="disabled() || null"
      (click)="!disabled() && toggled.emit(!selected())"
    >
      {{ label() }}
    </button>
  `,
  styles: [`
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      border: 1.5px solid var(--border);
      background: var(--card);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      min-height: 36px;

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
      }

      &:hover:not(.chip-disabled) {
        border-color: var(--primary);
        color: var(--primary);
        background: var(--primary-light);
      }
    }

    .chip-selected {
      border-color: var(--primary);
      background: var(--primary-light);
      color: var(--primary-dark);
    }

    .chip-disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `],
})
export class ChipComponent {
  label = input.required<string>();
  selected = input<boolean>(false);
  disabled = input<boolean>(false);

  toggled = output<boolean>();
}
