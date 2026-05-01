import {
  ChangeDetectionStrategy, Component, input, output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Invoice, InvoiceFilters } from '../legal.store';

@Component({
  selector: 'app-invoices-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, DecimalPipe],
  template: `
    <!-- Filtros -->
    <div class="filters">
      <select class="form-input" [ngModel]="filters().type"
        (ngModelChange)="onFilterChange('type', $event)">
        <option value="">Todos los tipos</option>
        <option value="boleta">Boleta</option>
        <option value="factura">Factura</option>
      </select>

      <div class="date-range">
        <input type="date" class="form-input" placeholder="Desde"
          [ngModel]="filters().dateFrom"
          (ngModelChange)="onFilterChange('dateFrom', $event)">
        <span class="date-sep">—</span>
        <input type="date" class="form-input" placeholder="Hasta"
          [ngModel]="filters().dateTo"
          (ngModelChange)="onFilterChange('dateTo', $event)">
      </div>

      <button class="btn btn--outline" (click)="export.emit()">
        <span class="material-icons-outlined" style="font-size:16px">download</span>
        Exportar
      </button>
    </div>

    <!-- Tabla -->
    @if (invoices().length === 0) {
      <div class="empty-state">
        <span class="material-icons-outlined empty-state__icon">receipt_long</span>
        <p class="empty-state__title">Sin comprobantes</p>
        <p class="empty-state__sub">No hay comprobantes que coincidan con los filtros seleccionados.</p>
      </div>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>N° Serie</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th class="text-right">Total</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (inv of invoices(); track inv.id) {
              <tr>
                <td class="mono">{{ inv.series }}</td>
                <td>{{ inv.date | date:'dd/MM/yyyy' }}</td>
                <td>{{ inv.customerName }}</td>
                <td>
                  @switch (inv.type) {
                    @case ('boleta') {
                      <span class="badge badge--green">Boleta</span>
                    }
                    @case ('factura') {
                      <span class="badge badge--blue">Factura</span>
                    }
                  }
                </td>
                <td class="text-right font-medium">S/ {{ inv.total | number:'1.2-2' }}</td>
                <td class="text-center">
                  <div class="actions">
                    <button class="icon-btn" title="Descargar PDF"
                      (click)="onDownload(inv)">
                      <span class="material-icons-outlined">download</span>
                    </button>
                    <button class="icon-btn" title="Ver comprobante"
                      (click)="onView(inv)">
                      <span class="material-icons-outlined">visibility</span>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .filters {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .date-range { display: flex; align-items: center; gap: 6px; }
    .date-sep { font-size: 13px; color: var(--text-muted); }

    .form-input {
      padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius);
      font-size: 13px; background: #fff; color: var(--text);
    }
    .form-input:focus { outline: none; border-color: var(--primary); }

    .btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
      border-radius: var(--radius); font-size: 13px; font-weight: 500; cursor: pointer;
      border: none; transition: background .15s;
    }
    .btn--outline {
      background: #fff; border: 1px solid var(--border); color: var(--text);
    }
    .btn--outline:hover { background: var(--surface); }

    .table-wrap { overflow-x: auto; }
    .table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .table th {
      text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .04em; color: var(--text-muted); padding: 10px 14px;
      border-bottom: 2px solid var(--border); white-space: nowrap;
    }
    .table td {
      padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: middle;
    }
    .table tr:last-child td { border-bottom: none; }
    .table tr:hover td { background: var(--surface); }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-medium { font-weight: 600; }
    .mono { font-family: monospace; font-size: 12px; }

    .badge {
      display: inline-flex; align-items: center; padding: 3px 10px;
      border-radius: 99px; font-size: 12px; font-weight: 500;
    }
    .badge--green { background: #D1FAE5; color: #065F46; }
    .badge--blue  { background: #DBEAFE; color: #1E40AF; }

    .actions { display: flex; gap: 4px; justify-content: center; }
    .icon-btn {
      width: 32px; height: 32px; border: none; background: transparent; cursor: pointer;
      border-radius: var(--radius); display: flex; align-items: center; justify-content: center;
      color: var(--text-muted); transition: background .15s;
    }
    .icon-btn:hover { background: var(--surface); color: var(--text); }
    .icon-btn .material-icons-outlined { font-size: 18px; }

    .empty-state {
      text-align: center; padding: 64px 24px;
      border: 2px dashed var(--border); border-radius: var(--radius-lg);
    }
    .empty-state__icon { font-size: 48px; color: #D1D5DB; display: block; margin-bottom: 12px; }
    .empty-state__title { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
    .empty-state__sub { font-size: 13px; color: var(--text-muted); margin: 0; }
  `],
})
export class InvoicesTabComponent {
  readonly invoices = input.required<Invoice[]>();
  readonly filters  = input.required<InvoiceFilters>();

  readonly filtersChange = output<InvoiceFilters>();
  readonly export        = output<void>();

  onFilterChange(field: keyof InvoiceFilters, value: string): void {
    this.filtersChange.emit({ ...this.filters(), [field]: value });
  }

  onDownload(inv: Invoice): void {
    // Mock: en producción dispararía descarga del PDF desde SUNAT/OSE
    console.log('Descargar comprobante', inv.series);
    alert(`Descargando ${inv.series}.pdf...`);
  }

  onView(inv: Invoice): void {
    // Mock: en producción abriría visor PDF
    console.log('Ver comprobante', inv.series);
    alert(`Visualizando ${inv.series}`);
  }
}
