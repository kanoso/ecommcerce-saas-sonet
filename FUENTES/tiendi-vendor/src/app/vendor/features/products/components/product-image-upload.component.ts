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
  template: `
    <div class="upload">
      <h3 class="upload__title">Imágenes del producto</h3>

      <div
        class="upload__zone"
        [class.upload__zone--drag]="isDragging()"
        (click)="fileInput.click()"
        (dragover)="$event.preventDefault(); isDragging.set(true)"
        (dragleave)="isDragging.set(false)"
        (drop)="onDrop($event)"
        role="button"
        tabindex="0"
        aria-label="Zona de carga de imágenes. Click o arrastrá imágenes aquí"
        (keydown.enter)="fileInput.click()"
        (keydown.space)="$event.preventDefault(); fileInput.click()"
      >
        <span class="material-icons-outlined upload__zone-icon" aria-hidden="true">cloud_upload</span>
        <p class="upload__zone-text">
          <strong>Click para seleccionar</strong> o arrastrá imágenes aquí
        </p>
        <p class="upload__zone-hint">PNG, JPG hasta 5MB cada una</p>
      </div>

      <input
        #fileInput
        type="file"
        accept="image/*"
        multiple
        class="upload__input"
        aria-hidden="true"
        tabindex="-1"
        (change)="onFileChange($event)"
      />

      @if (imageUrls().length > 0) {
        <div class="upload__preview" aria-label="Imágenes cargadas">
          @for (url of imageUrls(); track url; let i = $index) {
            <div class="upload__thumb" [attr.aria-label]="'Imagen ' + (i + 1)">
              <img [src]="url" [alt]="'Imagen ' + (i + 1)" class="upload__thumb-img" />
              <button
                class="upload__thumb-remove"
                (click)="removeImage(i)"
                type="button"
                [attr.aria-label]="'Quitar imagen ' + (i + 1)"
              >
                <span class="material-icons-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .upload__title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 12px;
    }

    .upload__zone {
      border: 2px dashed var(--border);
      border-radius: var(--radius-lg);
      padding: 28px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      background: var(--surface);
      user-select: none;

      &:hover, &--drag {
        border-color: var(--primary);
        background: var(--primary-light);
      }

      &:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
    }

    .upload__zone-icon {
      font-size: 36px;
      color: var(--primary);
    }

    .upload__zone-text {
      margin: 0;
      font-size: 14px;
      color: var(--text-secondary);
      text-align: center;

      strong { color: var(--primary); }
    }

    .upload__zone-hint {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .upload__input {
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
      pointer-events: none;
    }

    .upload__preview {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 12px;
    }

    .upload__thumb {
      position: relative;
      aspect-ratio: 1;
      border-radius: var(--radius);
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .upload__thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .upload__thumb-remove {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.15s;

      .material-icons-outlined { font-size: 14px; }

      &:hover { background: rgba(0, 0, 0, 0.8); }
      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }
    }
  `],
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
