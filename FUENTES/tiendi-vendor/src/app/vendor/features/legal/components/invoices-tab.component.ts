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
  templateUrl: './invoices-tab.component.html',
  styleUrl: './invoices-tab.component.scss',
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
