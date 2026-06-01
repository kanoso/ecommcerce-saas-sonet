import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { AuthStore } from '../../core/services/auth.store';
import { StoreConfigStore } from '../../features/store-config/store-config.store';
import { NotificationsStore } from '../../features/notifications/notifications.store';
import { VendorChatAdapter } from '../../features/chat';
import { ChatWidgetComponent } from '../../features/chat/chat-widget.component';
import { Theme, ChatAdapter } from '@tiendi/chat';

// ─── Stubs ───────────────────────────────────────────────────────────────────

const stubUser = {
  id: '42',
  name: 'Test Owner',
  email: 'owner@test.com',
  role: 'STORE_OWNER' as const,
  storeId: 'store-1',
  avatar: null,
};

const stubAuthStore = {
  currentUser: signal(stubUser),
  isAuthenticated: signal(true),
  isSuperAdmin: signal(false),
  loadFromStorage: () => {},
  fetchMe: () => {},
  logout: () => {},
};

const stubStoreConfigStore = {
  info: signal({ name: 'Test Store' }),
  loadStore: () => {},
};

const stubNotificationsStore = {
  unreadCount: signal(0),
  loadAll: () => {},
};

const stubChatAdapter = {
  listFriends: () => [],
  sendMessage: () => {},
  getMessageHistory: () => [],
  onFriendsListChanged: () => {},
  onMessageReceived: () => {},
  friendsListChangedHandler: () => {},
  messageReceivedHandler: () => {},
};

/**
 * Stub that replaces ChatWidgetComponent in the test to avoid
 * NgChatTiendi's DI requirements inside TestBed.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'td-chat-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ChatWidgetStub {
  readonly adapter = input<ChatAdapter | null>(null);
  readonly userId = input<string | null>(null);
  readonly theme = input<Theme>(Theme.Light);
}

// ─── Smoke Test ──────────────────────────────────────────────────────────────

describe('ShellComponent (smoke)', () => {
  let fixture: ComponentFixture<ShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: stubAuthStore },
        { provide: StoreConfigStore, useValue: stubStoreConfigStore },
        { provide: NotificationsStore, useValue: stubNotificationsStore },
        { provide: VendorChatAdapter, useValue: stubChatAdapter },
      ],
    })
      .overrideComponent(ShellComponent, {
        remove: { imports: [ChatWidgetComponent] },
        add: { imports: [ChatWidgetStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('should create without errors', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the td-chat-widget element', () => {
    const chatEl = fixture.nativeElement.querySelector('td-chat-widget');
    expect(chatEl).not.toBeNull();
  });
});
