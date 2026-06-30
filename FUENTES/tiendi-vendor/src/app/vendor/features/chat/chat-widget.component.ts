import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ChatAdapter, NgChatTiendi, Theme } from '@tiendi/chat';

@Component({
  selector: 'td-chat-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgChatTiendi],
  template: `
    <app-ng-chat-tiendi
      [adapter]="adapter()"
      [userId]="userId()"
      [theme]="theme()"
    />
  `,
})
export class ChatWidgetComponent {
  readonly adapter = input<ChatAdapter | null>(null);
  readonly userId = input<string | number | null>(null);
  readonly theme = input<Theme>(Theme.Light);
}
