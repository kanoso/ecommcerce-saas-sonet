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
  templateUrl: './order-status-tabs.component.html',
  styleUrl: './order-status-tabs.component.scss',
})
export class OrderStatusTabsComponent {
  readonly tabs = TABS;

  activeTab = input.required<string>();
  countByStatus = input.required<Record<string, number>>();

  tabChange = output<string>();
}
