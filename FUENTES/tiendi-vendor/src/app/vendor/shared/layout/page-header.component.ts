import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

@Component({
  selector: 'td-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="page-header__title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="page-header__subtitle">{{ subtitle() }}</p>
        }
      </div>

      <div class="page-header__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .page-header__text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .page-header__title {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;

      @media (max-width: 767px) { font-size: 20px; }
    }

    .page-header__subtitle {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0;
    }

    .page-header__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
  `],
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string | null>(null);
}
