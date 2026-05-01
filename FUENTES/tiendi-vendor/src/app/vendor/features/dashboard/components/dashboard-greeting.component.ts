import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'app-dashboard-greeting',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="greeting">
      <div class="greeting__top">
        <div>
          <h1 class="greeting__title">{{ greetingText() }}, {{ userName() }} 👋</h1>
          <p class="greeting__date">{{ formattedDate() }}</p>
        </div>
        @if (storeName()) {
          <div class="greeting__store" aria-label="Tienda activa">
            <span class="material-icons-outlined greeting__store-icon" aria-hidden="true">storefront</span>
            <span class="greeting__store-name">{{ storeName() }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .greeting { margin-bottom: 20px; }

    .greeting__top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .greeting__title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .greeting__date {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
      text-transform: capitalize;
    }

    .greeting__store {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--primary-light);
      border-radius: var(--radius-lg);
      flex-shrink: 0;
    }

    .greeting__store-icon {
      font-size: 16px;
      color: var(--primary);
    }

    .greeting__store-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--primary);
      white-space: nowrap;
    }
  `],
})
export class DashboardGreetingComponent {
  userName = input.required<string>();
  storeName = input<string>('');
  date = input.required<Date>();

  greetingText = computed(() => {
    const hour = this.date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  });

  formattedDate = computed(() =>
    new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(this.date()),
  );
}
