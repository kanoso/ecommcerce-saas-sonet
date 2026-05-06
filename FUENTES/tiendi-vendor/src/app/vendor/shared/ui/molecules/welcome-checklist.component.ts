import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface ChecklistItem {
  label: string;
  done: boolean;
}

@Component({
  selector: 'app-welcome-checklist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome-checklist.component.html',
  styleUrl: './welcome-checklist.component.scss',
})
export class WelcomeChecklistComponent {
  items = input.required<ChecklistItem[]>();

  doneCount = computed(() => this.items().filter((i) => i.done).length);
  progressPct = computed(() =>
    this.items().length ? Math.round((this.doneCount() / this.items().length) * 100) : 0,
  );
  allDone = computed(() => this.doneCount() === this.items().length && this.items().length > 0);
}
