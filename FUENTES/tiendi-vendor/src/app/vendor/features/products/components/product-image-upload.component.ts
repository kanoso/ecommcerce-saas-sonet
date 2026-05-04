import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'td-product-image-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-image-upload.component.html',
  styleUrl: './product-image-upload.component.scss',
})
export class ProductImageUploadComponent {
  imageUrls = input<string[]>([]);
  imagesChange = output<string[]>();

  isDragging = signal(false);

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.processFiles(Array.from(input.files));
      input.value = '';
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files) {
      this.processFiles(Array.from(event.dataTransfer.files));
    }
  }

  removeImage(index: number): void {
    const updated = [...this.imageUrls()];
    updated.splice(index, 1);
    this.imagesChange.emit(updated);
  }

  private processFiles(files: File[]): void {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    const readers = imageFiles.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((newUrls) => {
      this.imagesChange.emit([...this.imageUrls(), ...newUrls]);
    });
  }
}
