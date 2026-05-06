import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder for the individual customer detail route: /vendor/customers/:id
 * The inline detail is handled by CustomerDetailModalComponent from the list page.
 * This route can be used for a full-page detail view in a future iteration.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-detail.page.html',
})
export class CustomerDetailPage {}
