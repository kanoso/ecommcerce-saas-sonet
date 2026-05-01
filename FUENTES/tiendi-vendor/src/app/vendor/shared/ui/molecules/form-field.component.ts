import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

let nextId = 0;

@Component({
  selector: 'td-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-field" [class.form-field--error]="!!error()">
      <label
        [for]="fieldId()"
        class="form-field__label"
        [class.form-field__label--required]="required()"
      >
        {{ label() }}
        @if (required()) {
          <span class="form-field__required" aria-hidden="true">*</span>
        }
      </label>

      <div
        class="form-field__control"
        [attr.id]="fieldId()"
      >
        <ng-content />
      </div>

      @if (hint() && !error()) {
        <span
          [id]="hintId()"
          class="form-field__hint"
        >
          {{ hint() }}
        </span>
      }

      @if (error()) {
        <span
          [id]="errorId()"
          class="form-field__error"
          role="alert"
          aria-live="polite"
        >
          <span class="material-icons-outlined" aria-hidden="true">error_outline</span>
          {{ error() }}
        </span>
      }
    </div>
  `,
  styles: [`
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-field__label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .form-field__required {
      color: var(--danger);
      font-size: 14px;
    }

    .form-field__control {
      /* Inner inputs inherit full width */
      ::ng-deep input,
      ::ng-deep select,
      ::ng-deep textarea {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 9px 12px;
        font-family: inherit;
        font-size: 14px;
        color: var(--text-primary);
        background: var(--card);
        transition: border-color 0.15s;
        min-height: 44px;

        &:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.1);
        }
      }
    }

    .form-field--error .form-field__control {
      ::ng-deep input,
      ::ng-deep select,
      ::ng-deep textarea {
        border-color: var(--danger);
        &:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }
      }
    }

    .form-field__hint {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .form-field__error {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--danger);

      span.material-icons-outlined {
        font-size: 14px;
      }
    }
  `],
})
export class FormFieldComponent {
  label = input.required<string>();
  hint = input<string | null>(null);
  error = input<string | null>(null);
  required = input<boolean>(false);

  private readonly _id = `form-field-${++nextId}`;

  fieldId = computed(() => this._id);
  hintId = computed(() => `${this._id}-hint`);
  errorId = computed(() => `${this._id}-error`);
}
