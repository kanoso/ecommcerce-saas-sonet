import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { UiStore } from '../../core/services/ui.store';

@Component({
  selector: 'td-offline-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (uiStore.isOffline()) {
      <div
        class="offline-banner"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="material-icons-outlined" aria-hidden="true">wifi_off</span>
        <span>Sin conexión a internet. Verificá tu red para continuar operando.</span>
      </div>
    }
  `,
  styles: [`
    .offline-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      background: var(--warning);
      color: var(--text-on-warning);
      font-size: 13px;
      font-weight: 500;
      position: sticky;
      top: 0;
      z-index: 999;
      animation: slide-down 0.2s ease;

      span.material-icons-outlined { font-size: 18px; }
    }

    @keyframes slide-down {
      from { transform: translateY(-100%); }
      to   { transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .offline-banner { animation: none; }
    }
  `],
})
export class OfflineBannerComponent {
  readonly uiStore = inject(UiStore);
}
