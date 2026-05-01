import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopProduct } from '../analytics.store';

const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

@Component({
  selector: 'app-top-products-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Productos más vendidos</h3>
        <a routerLink="/vendor/products" class="link-all">Ver todos →</a>
      </div>

      @if (products().length === 0) {
        <div class="empty-state">
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p>Sin datos para este período</p>
        </div>
      } @else {
        <ul class="product-list">
          @for (product of products(); track product.rank) {
            <li class="product-row">
              <span class="rank-badge" [class.rank-badge--top]="product.rank <= 3">
                {{ product.rank }}
              </span>
              <div class="product-info">
                <div class="product-name-row">
                  <span class="product-name">{{ product.name }}</span>
                  <span class="product-revenue">{{ formatMoney(product.revenue) }}</span>
                </div>
                <div class="progress-row">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      [style.width.%]="(product.revenue / product.maxRevenue) * 100"
                    ></div>
                  </div>
                  <span class="product-units">{{ product.units }} uds.</span>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    .link-all {
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }
    .link-all:hover { text-decoration: underline; }
    .product-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .product-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .rank-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--surface);
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .rank-badge--top {
      background: #D1FAE5;
      color: #047857;
    }
    .product-info {
      flex: 1;
      min-width: 0;
    }
    .product-name-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;
    }
    .product-name {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .product-revenue {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary);
      white-space: nowrap;
    }
    .progress-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .progress-bar {
      flex: 1;
      height: 6px;
      background: var(--surface);
      border-radius: 99px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 99px;
      transition: width 0.4s ease;
    }
    .product-units {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 40px 0;
      color: var(--text-muted);
      font-size: 14px;
    }
  `],
})
export class TopProductsListComponent {
  products = input.required<TopProduct[]>();

  formatMoney(value: number): string {
    return PEN.format(value);
  }
}
