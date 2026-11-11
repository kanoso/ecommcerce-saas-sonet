import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AdminAlertsStore } from '../alerts/admin-alerts.store';

export function alertTypeLabel(type: string): string {
  switch (type) {
    case 'LATE_PAYMENT_CLAIM':
      return 'Reclamo de pago tardío';
    case 'PROOF_VERIFICATION_TIMEOUT':
      return 'Comprobante por vencer';
    case 'FAILED_NOTIFICATION':
    case 'NOTIFICATION_FAILED':
      return 'Notificación fallida';
    case 'DRAW_BLOCKED':
      return 'Sorteo bloqueado';
    case 'CLOSE_BLOCKED':
      return 'Cierre de ventas bloqueado';
    case 'PAYMENT_ACCOUNT_CHANGE':
    case 'PAYMENT_ACCOUNT_PROPOSED':
      return 'Cambio en cuenta de pago';
    default:
      return type;
  }
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent implements OnInit {
  protected readonly alertsStore = inject(AdminAlertsStore);
  protected readonly alertTypeLabel = alertTypeLabel;
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.alertsStore.load();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.alertsStore.load();
      });
  }
}
