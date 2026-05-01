import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AnalyticsSummary } from '../analytics.store';

const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

@Component({
  selector: 'app-analytics-kpi-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi-grid">
      <!-- Ventas totales -->
      <div class="kpi-card">
        <div class="kpi-icon kpi-icon--sales">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Ventas totales</span>
          <span class="kpi-value">{{ summary() ? formatMoney(summary()!.totalSales) : '—' }}</span>
          @if (summary()) {
            <span class="kpi-change" [class.kpi-change--up]="summary()!.totalSalesChange >= 0" [class.kpi-change--down]="summary()!.totalSalesChange < 0">
              {{ summary()!.totalSalesChange >= 0 ? '↑' : '↓' }} {{ abs(summary()!.totalSalesChange) }}% vs período anterior
            </span>
          }
        </div>
      </div>

      <!-- Pedidos -->
      <div class="kpi-card">
        <div class="kpi-icon kpi-icon--orders">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Pedidos</span>
          <span class="kpi-value">{{ summary() ? summary()!.totalOrders : '—' }}</span>
          @if (summary()) {
            <span class="kpi-change" [class.kpi-change--up]="summary()!.totalOrdersChange >= 0" [class.kpi-change--down]="summary()!.totalOrdersChange < 0">
              {{ summary()!.totalOrdersChange >= 0 ? '↑' : '↓' }} {{ abs(summary()!.totalOrdersChange) }}% vs período anterior
            </span>
          }
        </div>
      </div>

      <!-- Ticket promedio -->
      <div class="kpi-card">
        <div class="kpi-icon kpi-icon--ticket">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 6h16v12H4V6z" />
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Ticket promedio</span>
          <span class="kpi-value">{{ summary() ? formatMoney(summary()!.avgTicket) : '—' }}</span>
          @if (summary()) {
            <span class="kpi-change" [class.kpi-change--up]="summary()!.avgTicketChange >= 0" [class.kpi-change--down]="summary()!.avgTicketChange < 0">
              {{ summary()!.avgTicketChange >= 0 ? '↑' : '↓' }} {{ abs(summary()!.avgTicketChange) }}% vs período anterior
            </span>
          }
        </div>
      </div>

      <!-- Clientes nuevos -->
      <div class="kpi-card">
        <div class="kpi-icon kpi-icon--customers">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Clientes nuevos</span>
          <span class="kpi-value">{{ summary() ? summary()!.newCustomers : '—' }}</span>
          @if (summary()) {
            <span class="kpi-change" [class.kpi-change--up]="summary()!.newCustomersChange >= 0" [class.kpi-change--down]="summary()!.newCustomersChange < 0">
              {{ summary()!.newCustomersChange >= 0 ? '↑' : '↓' }} {{ abs(summary()!.newCustomersChange) }}% vs período anterior
            </span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    @media (max-width: 1024px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .kpi-grid { grid-template-columns: 1fr; }
    }
    .kpi-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }
    .kpi-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .kpi-icon--sales { background: #D1FAE5; color: #047857; }
    .kpi-icon--orders { background: #DBEAFE; color: #1D4ED8; }
    .kpi-icon--ticket { background: #FEF3C7; color: #B45309; }
    .kpi-icon--customers { background: #EDE9FE; color: #6D28D9; }
    .kpi-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .kpi-label {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .kpi-value {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      line-height: 1.2;
    }
    .kpi-change {
      font-size: 12px;
      font-weight: 500;
      margin-top: 2px;
    }
    .kpi-change--up { color: #047857; }
    .kpi-change--down { color: #EF4444; }
  `],
})
export class AnalyticsKpiGridComponent {
  summary = input.required<AnalyticsSummary | null>();

  formatMoney(value: number): string {
    return PEN.format(value);
  }

  abs(value: number): number {
    return Math.abs(value);
  }
}
