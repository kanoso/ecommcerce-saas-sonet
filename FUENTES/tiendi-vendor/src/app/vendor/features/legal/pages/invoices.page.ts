/**
 * Legacy route stub — redirige a LegalPage con tab 'invoices' activo.
 * Ruta: /vendor/legal/invoices
 */
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LegalStore } from '../legal.store';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class InvoicesPage implements OnInit {
  private readonly store  = inject(LegalStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.store.setTab('invoices');
    this.router.navigate(['/legal'], { replaceUrl: true });
  }
}
