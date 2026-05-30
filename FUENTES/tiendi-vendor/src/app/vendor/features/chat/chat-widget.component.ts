/**
 * Thin wrapper that dynamically instantiates NgChatTiendi from @tiendi/chat.
 *
 * This wrapper exists to isolate the Angular version brand mismatch between
 * the tiendi-chat library (compiled with Angular 20) and tiendi-vendor (Angular 21).
 * Using ViewContainerRef.createComponent() + ComponentRef.setInput() bypasses
 * template strict-type-checking of InputSignal brands while still rendering
 * the library component correctly at runtime.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  effect,
  inject,
  input,
  OnInit,
  ViewContainerRef,
} from '@angular/core';
import { NgChatTiendi, Theme, ChatAdapter } from '@tiendi/chat';

@Component({
  selector: 'td-chat-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class ChatWidgetComponent implements OnInit {
  readonly adapter = input<ChatAdapter | null>(null);
  readonly userId = input<string | null>(null);
  readonly theme = input<Theme>(Theme.Light);

  private readonly vcr = inject(ViewContainerRef);
  private chatRef: ComponentRef<NgChatTiendi> | null = null;

  ngOnInit(): void {
    this.chatRef = this.vcr.createComponent(NgChatTiendi);
    this.setInputs();
  }

  constructor() {
    // Re-propagate reactive input changes after init
    effect(() => {
      if (!this.chatRef) return;
      this.setInputs();
    });
  }

  private setInputs(): void {
    if (!this.chatRef) return;
    this.chatRef.setInput('adapter', this.adapter());
    this.chatRef.setInput('userId', this.userId());
    this.chatRef.setInput('theme', this.theme());
  }
}
