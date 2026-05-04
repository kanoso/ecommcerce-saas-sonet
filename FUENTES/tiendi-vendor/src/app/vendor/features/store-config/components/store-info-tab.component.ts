import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StoreInfo } from '../store-config.store';

@Component({
  selector: 'app-store-info-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './store-info-tab.component.html',
  styleUrl: './store-info-tab.component.scss',
})
export class StoreInfoTabComponent implements OnInit {
  info      = input.required<StoreInfo>();
  isSaving  = input<boolean>(false);
  save      = output<StoreInfo>();
  toggleOpen = output<void>();

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name:        [''],
    description: [''],
    category:    [''],
    phone:       [''],
    address:     [''],
    logoUrl:     [''],
    storeSlug:   [''],
    isOpen:      [true],
    whatsapp:    [''],
    instagram:   [''],
    facebook:    [''],
  });

  ngOnInit(): void {
    this.form.patchValue(this.info());
  }

  initial(): string {
    const name = this.form.value.name ?? '';
    return name.charAt(0).toUpperCase() || 'T';
  }

  onLogoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    this.form.patchValue({ logoUrl: url });
  }

  copyLink(): void {
    const slug = this.form.value.storeSlug ?? '';
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    navigator.clipboard?.writeText(`tiendi.pe/${slug}`).catch(() => {});
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.save.emit(this.form.getRawValue() as StoreInfo);
    }
  }
}
