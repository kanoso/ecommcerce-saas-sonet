import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopProduct } from '../analytics.store';

const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

@Component({
  selector: 'app-top-products-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './top-products-list.component.html',
  styleUrl: './top-products-list.component.scss',
})
export class TopProductsListComponent {
  products = input.required<TopProduct[]>();

  formatMoney(value: number): string {
    return PEN.format(value);
  }
}
