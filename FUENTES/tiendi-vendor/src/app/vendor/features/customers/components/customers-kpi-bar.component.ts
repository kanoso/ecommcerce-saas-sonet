import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CustomersSummary } from '../customers.store';

/**
 * Usage:
 * <app-customers-kpi-bar [summary]="store.summary()" />
 */
@Component({
  selector: 'app-customers-kpi-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <div class="kpi-bar">
      <!-- Total Clientes -->
      <div class="kpi-card kpi-primary">
        <div class="kpi-icon" aria-hidden="true">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Clientes totales</span>
          <span class="kpi-value">{{ summary()?.total ?? '—' }}</span>
        </div>
      </div>

      <!-- Nuevos este mes -->
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon" aria-hidden="true">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Nuevos este mes</span>
          <span class="kpi-value">{{ summary()?.newThisMonth ?? '—' }}</span>
        </div>
      </div>

      <!-- Compra promedio -->
      <div class="kpi-card kpi-warning">
        <div class="kpi-icon" aria-hidden="true">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Compra promedio</span>
          <span class="kpi-value">
            @if (summary()) {
              S/ {{ summary()!.avgTicket | number:'1.2-2' }}
            } @else {
              —
            }
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .kpi-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    @media (max-width: 640px) {
      .kpi-bar {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--card, #fff);
      border: 1px solid var(--border, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
    }

    .kpi-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--radius, 8px);
      flex-shrink: 0;
    }

    .kpi-primary .kpi-icon {
      background: #D1FAE5;
      color: var(--primary, #047857);
    }

    .kpi-blue .kpi-icon {
      background: #DBEAFE;
      color: #2563EB;
    }

    .kpi-warning .kpi-icon {
      background: #FEF3C7;
      color: var(--warning, #F59E0B);
    }

    .kpi-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kpi-label {
      font-size: 13px;
      color: var(--text-muted, #6B7280);
      font-weight: 500;
    }

    .kpi-value {
      font-size: 26px;
      font-weight: 700;
      color: #111827;
      line-height: 1.1;
    }
  `],
})
export class CustomersKpiBarComponent {
  summary = input<CustomersSummary | null>(null);
}
