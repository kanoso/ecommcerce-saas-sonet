import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'td-product-preview-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <div class="preview">
      <p class="preview__caption">Vista previa del producto</p>

      <div class="preview__card" aria-label="Vista previa del producto">
        <div class="preview__img">
          @if (imageUrl()) {
            <img [src]="imageUrl()!" [alt]="name() || 'Producto'" class="preview__image" />
          } @else {
            <span class="material-icons-outlined preview__placeholder" aria-hidden="true">
              inventory_2
            </span>
          }
        </div>

        <div class="preview__body">
          <p class="preview__name">{{ name() || 'Nombre del producto' }}</p>

          @if (price()) {
            <div class="preview__pricing">
              @if (discountPrice()) {
                <span class="preview__price-offer">S/ {{ discountPrice() | number:'1.2-2' }}</span>
                <span class="preview__price-orig">S/ {{ price() | number:'1.2-2' }}</span>
              } @else {
                <span class="preview__price">S/ {{ price() | number:'1.2-2' }}</span>
              }
            </div>
          } @else {
            <p class="preview__price-empty">S/ 0.00</p>
          }
        </div>
      </div>

      <p class="preview__hint">Así verán el producto tus clientes</p>
    </div>
  `,
  styles: [`
    .preview {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .preview__caption {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .preview__card {
      width: 100%;
      max-width: 220px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: var(--shadow);
    }

    .preview__img {
      height: 140px;
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .preview__placeholder {
      font-size: 48px;
      color: var(--border);
    }

    .preview__body {
      padding: 12px;
    }

    .preview__name {
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .preview__pricing {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .preview__price {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .preview__price-offer {
      font-size: 16px;
      font-weight: 700;
      color: var(--primary);
    }

    .preview__price-orig {
      font-size: 12px;
      color: var(--text-secondary);
      text-decoration: line-through;
    }

    .preview__price-empty {
      margin: 0;
      font-size: 14px;
      color: var(--text-secondary);
    }

    .preview__hint {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
      text-align: center;
    }
  `],
})
export class ProductPreviewCardComponent {
  name = input<string>('');
  price = input<number | null>(null);
  discountPrice = input<number | null>(null);
  imageUrl = input<string | null>(null);
}
