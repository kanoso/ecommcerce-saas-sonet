import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { Order } from '../orders.store';

@Component({
  selector: 'td-order-delivery-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" role="region" aria-label="Información de entrega">
      <h2 class="card__title">Entrega</h2>

      @if (order().deliveryType === 'DELIVERY') {
        <div class="delivery">
          <div class="delivery__address-row">
            <span class="material-symbols-rounded delivery__icon" aria-hidden="true">place</span>
            <span class="delivery__address">{{ order().deliveryAddress }}</span>
          </div>
          <div class="map-placeholder" role="img" aria-label="Mapa de la dirección de entrega">
            <span class="material-symbols-rounded map-placeholder__icon" aria-hidden="true">map</span>
            <button class="map-placeholder__btn" type="button" aria-label="Ver dirección en mapa">
              Ver en mapa
            </button>
          </div>
        </div>
      } @else {
        <div class="pickup">
          <span class="material-symbols-rounded pickup__icon" aria-hidden="true">store</span>
          <div class="pickup__info">
            <span class="pickup__label">Recojo en tienda</span>
            <span class="pickup__sub">El cliente retira en tienda</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .card {
      background: var(--card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      border: 1px solid var(--border);
      padding: 20px;
    }

    .card__title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 16px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .delivery__address-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 13px;
      color: var(--text-primary);
    }

    .delivery__icon {
      font-size: 18px;
      color: var(--primary);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .map-placeholder {
      height: 100px;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px dashed var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .map-placeholder__icon {
      font-size: 28px;
      color: var(--text-secondary);
      opacity: 0.5;
    }

    .map-placeholder__btn {
      background: none;
      border: none;
      font-size: 12px;
      color: var(--primary);
      cursor: pointer;
      font-weight: 500;
      text-decoration: underline;
      padding: 0;
    }

    .pickup {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--surface);
      border-radius: var(--radius);
    }

    .pickup__icon {
      font-size: 24px;
      color: var(--primary);
      flex-shrink: 0;
    }

    .pickup__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .pickup__label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .pickup__sub {
      font-size: 12px;
      color: var(--text-secondary);
    }
  `],
})
export class OrderDeliveryInfoComponent {
  order = input.required<Order>();
}
