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
  templateUrl: './product-preview-card.component.html',
  styleUrl: './product-preview-card.component.scss',
})
export class ProductPreviewCardComponent {
  name = input<string>('');
  price = input<number | null>(null);
  discountPrice = input<number | null>(null);
  imageUrl = input<string | null>(null);
}
