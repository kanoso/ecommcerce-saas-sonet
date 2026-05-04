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
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
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
