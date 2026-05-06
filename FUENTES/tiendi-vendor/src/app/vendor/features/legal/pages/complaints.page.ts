/**
 * Legacy route stub — redirige a LegalPage con tab 'complaints' activo.
 * Ruta: /vendor/legal/complaints
 */
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LegalStore } from '../legal.store';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './complaints.page.html',
})
export class ComplaintsPage implements OnInit {
  private readonly store  = inject(LegalStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.store.setTab('complaints');
    this.router.navigate(['/legal'], { replaceUrl: true });
  }
}
