import {
  ChangeDetectionStrategy, Component, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Complaint, deadlineDays } from '../legal.store';

@Component({
  selector: 'app-complaints-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe],
  templateUrl: './complaints-tab.component.html',
  styleUrl: './complaints-tab.component.scss',
})
export class ComplaintsTabComponent {
  readonly complaints = input.required<Complaint[]>();

  readonly respond   = output<{ id: string; response: string }>();
  readonly saveDraft = output<{ id: string; draft: string }>();

  readonly expandedId = signal<string | null>(null);

  // Local drafts — keyed by complaint id
  private drafts: Record<string, string> = {};

  get pendingCount(): () => number {
    return () => this.complaints().filter(c => c.status === 'PENDING').length;
  }

  getDays(c: Complaint): number {
    return deadlineDays(c);
  }

  getDraft(c: Complaint): string {
    return this.drafts[c.id] ?? c.responseDraft ?? '';
  }

  setDraft(id: string, value: string): void {
    this.drafts[id] = value;
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  onSaveDraft(c: Complaint): void {
    const draft = this.drafts[c.id] ?? '';
    this.saveDraft.emit({ id: c.id, draft });
  }

  onRespond(c: Complaint): void {
    const response = this.drafts[c.id] ?? '';
    if (!response.trim()) return;
    this.respond.emit({ id: c.id, response });
    // Clear local draft after sending
    delete this.drafts[c.id];
  }
}
