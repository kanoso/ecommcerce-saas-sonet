import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { UiStore, Toast } from '../../core/services/ui.store';

const TOAST_ICONS: Record<Toast['type'], string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

@Component({
  selector: 'td-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  readonly uiStore = inject(UiStore);

  toastIcon(toast: Toast): string {
    return TOAST_ICONS[toast.type];
  }
}
