import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface ChecklistItem {
  label: string;
  done: boolean;
}

@Component({
  selector: 'app-welcome-checklist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="checklist">
      @if (allDone()) {
        <p class="checklist__complete">🎉 ¡Perfil completo!</p>
      } @else {
        <p class="checklist__title">¡Completá tu perfil!</p>

        <div class="checklist__bar-wrap" role="progressbar"
          [attr.aria-valuenow]="doneCount()"
          [attr.aria-valuemax]="items().length"
          aria-label="Progreso del perfil">
          <div class="checklist__bar">
            <div class="checklist__bar-fill" [style.width.%]="progressPct()"></div>
          </div>
          <span class="checklist__bar-label">{{ doneCount() }}/{{ items().length }}</span>
        </div>

        <ul class="checklist__list">
          @for (item of items(); track item.label) {
            <li class="checklist__item">
              <span>{{ item.done ? '✅' : '⬜' }}</span>
              <span [class.checklist__item--done]="item.done">{{ item.label }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .checklist {
      background: #D1FAE5;
      border: 1px solid #A7F3D0;
      border-radius: 12px;
      padding: 16px;
    }

    .checklist__title {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary-dark);
      margin: 0 0 10px;
    }

    .checklist__complete {
      font-size: 15px;
      font-weight: 600;
      color: #065F46;
      margin: 0;
      text-align: center;
    }

    .checklist__bar-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .checklist__bar {
      flex: 1;
      background: #BBF7D0;
      border-radius: 4px;
      height: 6px;
      overflow: hidden;
    }

    .checklist__bar-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 4px;
      transition: width 0.4s ease;
    }

    .checklist__bar-label {
      font-size: 11px;
      font-weight: 600;
      color: #065F46;
      min-width: 28px;
    }

    .checklist__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .checklist__item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-primary);
    }

    .checklist__item--done {
      color: #065F46;
    }
  `],
})
export class WelcomeChecklistComponent {
  items = input.required<ChecklistItem[]>();

  doneCount = computed(() => this.items().filter((i) => i.done).length);
  progressPct = computed(() =>
    this.items().length ? Math.round((this.doneCount() / this.items().length) * 100) : 0,
  );
  allDone = computed(() => this.doneCount() === this.items().length && this.items().length > 0);
}
