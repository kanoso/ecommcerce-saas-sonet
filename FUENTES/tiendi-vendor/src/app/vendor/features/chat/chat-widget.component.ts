import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ChatAdapter, Theme } from '@tiendi/chat';

/**
 * Stub — disabled until @tiendi/chat is rebuilt targeting Angular 21.
 * Do NOT add NgChatTiendi to imports here — it was compiled with Angular 20
 * and causes NG0203 (EnvironmentInjector injection context failure) when linked
 * by the Angular 21 compiler. Use ViewContainerRef.createComponent() when re-enabling.
 */
@Component({
  selector: 'td-chat-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class ChatWidgetComponent {
  readonly adapter = input<ChatAdapter | null>(null);
  readonly userId = input<string | null>(null);
  readonly theme = input<Theme>(Theme.Light);
}
