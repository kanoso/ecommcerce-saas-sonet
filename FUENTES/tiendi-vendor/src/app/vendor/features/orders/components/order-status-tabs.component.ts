import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

interface TabDef {
  key: string;
  label: string;
}

const TABS: TabDef[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'CONFIRMED', label: 'Confirmados' },
  { key: 'DISPATCHED', label: 'En camino' },
  { key: 'DELIVERED', label: 'Entregados' },
  { key: 'REJECTED', label: 'Rechazados' },
];

@Component({
  selector: 'td-order-status-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" role="tablist" aria-label="Filtrar pedidos por estado">
      <div class="tabs">
        @for (tab of tabs; track tab.key) {
          <button
            class="tab"
            [class.tab--active]="activeTab() === tab.key"
            role="tab"
            [attr.aria-selected]="activeTab() === tab.key"
            [attr.aria-label]="tab.label + ': ' + countByStatus()[tab.key] + ' pedidos'"
            type="button"
            (click)="tabChange.emit(tab.key)"
          >
            {{ tab.label }}
            <span
              class="tab__count"
              [class.tab__count--warning]="tab.key === 'PENDING' && countByStatus()['PENDING'] > 0"
            >
              {{ countByStatus()[tab.key] }}
            </span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .card {
      background: var(--card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      border: 1px solid var(--border);
      margin-bottom: 16px;
      overflow: hidden;
    }

    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
      padding: 0 20px;
      scrollbar-width: none;

      &::-webkit-scrollbar { display: none; }
    }

    .tab {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      white-space: nowrap;
      border-bottom: 2px solid transparent;
      transition: color 0.15s, border-color 0.15s;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: -1px;

      &:hover { color: var(--text-primary); }
    }

    .tab--active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    .tab__count {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--surface);
      color: var(--text-secondary);
    }

    .tab__count--warning {
      background: #FEF3C7;
      color: #92400E;
    }
  `],
})
export class OrderStatusTabsComponent {
  readonly tabs = TABS;

  activeTab = input.required<string>();
  countByStatus = input.required<Record<string, number>>();

  tabChange = output<string>();
}
