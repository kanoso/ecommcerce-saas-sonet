import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnChanges,
  output,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../../shared/ui/organisms/dialog.component';
import { ButtonComponent } from '../../../shared/ui/atoms/button.component';

@Component({
  selector: 'app-invite-rider-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent, ReactiveFormsModule],
  templateUrl: './invite-rider-dialog.component.html',
  styleUrl: './invite-rider-dialog.component.scss',
})
export class InviteRiderDialogComponent implements OnChanges {
  visible  = input<boolean>(false);
  isSaving = input<boolean>(false);

  submitted = output<string>();
  closed    = output<void>();

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\s\-]{6,}$/)]],
  });

  ngOnChanges(changes: SimpleChanges): void {
    // Reset form when dialog closes
    if (changes['visible'] && !changes['visible'].currentValue) {
      this.form.reset();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitted.emit(this.form.getRawValue().phone);
  }

  onClose(): void {
    this.form.reset();
    this.closed.emit();
  }
}
