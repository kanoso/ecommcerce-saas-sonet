import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductData } from '../onboarding.store';
import { OnboardingNavComponent } from './onboarding-nav.component';

@Component({
  selector: 'app-onboarding-step2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, OnboardingNavComponent],
  templateUrl: './onboarding-step2.component.html',
  styleUrl: './onboarding-step2.component.scss',
})
export class OnboardingStep2Component implements OnInit {
  data = input.required<ProductData>();
  dataChange = output<Partial<ProductData>>();
  next = output<void>();
  prev = output<void>();
  skip = output<void>();

  imagePreview: string | null = null;

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    price: [null as number | null, [Validators.min(0)]],
    stock: [null as number | null, [Validators.min(0)]],
  });

  ngOnInit(): void {
    const d = this.data();
    this.form.patchValue({ name: d.name, price: d.price, stock: d.stock });
    if (d.imageUrl) this.imagePreview = d.imageUrl;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFile(file);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.readFile(file);
  }

  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.imagePreview = base64;
      this.dataChange.emit({ imageUrl: base64 });
    };
    reader.readAsDataURL(file);
  }

  onNext(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dataChange.emit(this.form.value as Partial<ProductData>);
    this.next.emit();
  }
}
