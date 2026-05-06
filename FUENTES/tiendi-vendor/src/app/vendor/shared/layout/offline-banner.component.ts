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
  templateUrl: './offline-banner.component.html',
  styleUrl: './offline-banner.component.scss',
})
export class OfflineBannerComponent {
  readonly uiStore = inject(UiStore);
}
