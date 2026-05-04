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
  templateUrl: './customers-kpi-bar.component.html',
  styleUrl: './customers-kpi-bar.component.scss',
})
export class CustomersKpiBarComponent {
  summary = input<CustomersSummary | null>(null);
}
