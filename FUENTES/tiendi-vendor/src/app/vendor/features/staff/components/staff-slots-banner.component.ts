import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-staff-slots-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="slots-banner">
      <div class="slots-banner__info">
        <span class="material-icons-outlined" style="color:#2563EB;font-size:22px">group</span>
        <div>
          <div class="slots-banner__title">Usando {{ used() }} de {{ max() }} slots — Plan Pro</div>
          @if (used() >= max()) {
            <div class="slots-banner__sub slots-banner__sub--warn">Límite alcanzado. Pasá al plan Business para agregar más.</div>
          } @else {
            <div class="slots-banner__sub">¿Necesitás más colaboradores? Pasá al plan Business</div>
          }
        </div>
      </div>
      <a routerLink="/vendor/subscription" class="slots-banner__link">Ver planes →</a>
    </div>
  `,
  styles: [`
    .slots-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: var(--radius-lg);
      padding: 14px 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .slots-banner__info { display: flex; align-items: center; gap: 12px; }

    .slots-banner__title { font-size: 14px; font-weight: 600; color: #1E40AF; }
    .slots-banner__sub { font-size: 12px; color: #1D4ED8; margin-top: 2px; }
    .slots-banner__sub--warn { color: #DC2626; }

    .slots-banner__link {
      font-size: 13px;
      font-weight: 500;
      color: #2563EB;
      border: 1px solid #BFDBFE;
      border-radius: var(--radius);
      padding: 6px 14px;
      text-decoration: none;
      white-space: nowrap;
      transition: background 0.15s;

      &:hover { background: #DBEAFE; }
    }
  `],
})
export class StaffSlotsBannerComponent {
  used = input.required<number>();
  max  = input.required<number>();
}
