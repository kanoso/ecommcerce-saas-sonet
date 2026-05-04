import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoreData } from '../onboarding.store';
import { OnboardingNavComponent } from './onboarding-nav.component';

@Component({
  selector: 'app-onboarding-step1',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, OnboardingNavComponent],
  templateUrl: './onboarding-step1.component.html',
  styleUrl: './onboarding-step1.component.scss',
})
export class OnboardingStep1Component implements OnInit {
  data = input.required<StoreData>();
  dataChange = output<Partial<StoreData>>();
  next = output<void>();
  skip = output<void>();

  logoPreview: string | null = null;

  get initials(): string {
    const name = (this.form?.get('name')?.value as string) ?? '';
    return name.trim().slice(0, 2) || '🏪';
  }

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    description: ['', [Validators.maxLength(200)]],
    address: [''],
    whatsapp: [''],
  });

  ngOnInit(): void {
    const d = this.data();
    this.form.patchValue({
      name: d.name,
      description: d.description,
      address: d.address,
      whatsapp: d.whatsapp,
    });
    if (d.logoUrl) {
      this.logoPreview = d.logoUrl;
    }
  }

  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.logoPreview = base64;
      this.dataChange.emit({ logoUrl: base64 });
    };
    reader.readAsDataURL(file);
  }

  onNext(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dataChange.emit(this.form.value as Partial<StoreData>);
    this.next.emit();
  }
}
