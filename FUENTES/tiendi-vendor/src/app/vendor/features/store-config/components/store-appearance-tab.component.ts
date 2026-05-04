import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StoreAppearance } from '../store-config.store';

@Component({
  selector: 'app-store-appearance-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './store-appearance-tab.component.html',
  styleUrl: './store-appearance-tab.component.scss',
})
export class StoreAppearanceTabComponent implements OnInit {
  appearance = input.required<StoreAppearance>();
  storeName  = input<string>('');
  isSaving   = input<boolean>(false);
  save       = output<StoreAppearance>();

  protected readonly dragOver = signal(false);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    primaryColor:   ['#047857'],
    bannerUrl:      [''],
    welcomeMessage: [''],
  });

  ngOnInit(): void {
    this.form.patchValue(this.appearance());
  }

  syncColorText(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.form.patchValue({ primaryColor: color });
  }

  adjustColor(hex: string): string {
    try {
      const n = parseInt(hex.replace('#', ''), 16);
      const r = Math.max(0, (n >> 16) - 20);
      const g = Math.max(0, ((n >> 8) & 0xff) - 20);
      const b = Math.max(0, (n & 0xff) - 20);
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    } catch { return hex; }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.form.patchValue({ bannerUrl: URL.createObjectURL(file) });
    }
  }

  onBannerChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.form.patchValue({ bannerUrl: URL.createObjectURL(file) });
    }
  }

  onSubmit(): void {
    this.save.emit(this.form.getRawValue() as StoreAppearance);
  }
}
