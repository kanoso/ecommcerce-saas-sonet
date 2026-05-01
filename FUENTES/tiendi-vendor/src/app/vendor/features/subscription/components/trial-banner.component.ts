import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

// Usage: <app-trial-banner [daysLeft]="store.trialDaysLeft()" (upgrade)="scrollToPlans()" />

@Component({
  selector: 'app-trial-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="trial-banner" role="alert" aria-live="polite">
      <div class="trial-banner__content">
        <span class="trial-banner__icon" aria-hidden="true">⏳</span>
        <div class="trial-banner__text">
          <strong>Tu período de prueba vence en {{ daysLeft() }} {{ daysLeft() === 1 ? 'día' : 'días' }}</strong>
          <span>Activá tu plan para no perder el acceso a tus productos y pedidos.</span>
        </div>
      </div>
      <button class="btn-upgrade" type="button" (click)="upgrade.emit()">
        Actualizar a Pro ahora
      </button>
    </div>
  `,
  styles: [`
    .trial-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 20px;
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
      border: 1px solid #F59E0B;
      border-radius: var(--radius-lg, 12px);
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .trial-banner__content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .trial-banner__icon {
      font-size: 22px;
      flex-shrink: 0;
    }

    .trial-banner__text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .trial-banner__text strong {
      font-size: 14px;
      font-weight: 700;
      color: #92400E;
    }

    .trial-banner__text span {
      font-size: 13px;
      color: #78350F;
    }

    .btn-upgrade {
      flex-shrink: 0;
      padding: 9px 18px;
      background: var(--primary, #047857);
      color: #fff;
      border: none;
      border-radius: var(--radius, 8px);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
    }

    .btn-upgrade:hover {
      background: var(--primary-dark, #065F46);
    }

    @media (max-width: 600px) {
      .trial-banner {
        flex-direction: column;
        align-items: flex-start;
      }
      .btn-upgrade { width: 100%; text-align: center; }
    }
  `],
})
export class TrialBannerComponent {
  readonly daysLeft = input.required<number>();
  readonly upgrade = output<void>();
}
