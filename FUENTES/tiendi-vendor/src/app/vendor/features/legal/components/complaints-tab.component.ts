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
  template: `
    <!-- Header -->
    <div class="complaints-header">
      <div class="complaints-header__counts">
        <strong>{{ complaints().length }} reclamacion{{ complaints().length !== 1 ? 'es' : '' }}</strong>
        @if (pendingCount() > 0) {
          <span class="pending-dot">{{ pendingCount() }} pendiente{{ pendingCount() !== 1 ? 's' : '' }} de respuesta</span>
        }
      </div>
      <div class="indecopi-note">
        <span class="material-icons-outlined" style="font-size:15px;vertical-align:middle">info</span>
        Plazo legal INDECOPI: <strong>30 días hábiles</strong> para responder desde la recepción.
      </div>
    </div>

    <!-- Tabla -->
    @if (complaints().length === 0) {
      <div class="empty-state">
        <span class="material-icons-outlined empty-state__icon">inbox</span>
        <p class="empty-state__title">Sin reclamaciones</p>
        <p class="empty-state__sub">No hay reclamaciones registradas en el libro.</p>
      </div>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th style="width:40px"></th>
              <th>N°</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Vence</th>
            </tr>
          </thead>
          <tbody>
            @for (c of complaints(); track c.id) {
              <tr class="complaint-row" [class.complaint-row--expanded]="expandedId() === c.id"
                (click)="toggleExpand(c.id)" style="cursor:pointer">
                <td class="expand-cell">
                  <span class="material-icons-outlined expand-icon"
                    [class.expanded]="expandedId() === c.id">
                    chevron_right
                  </span>
                </td>
                <td class="mono">{{ c.code }}</td>
                <td>{{ c.createdAt | date:'dd/MM/yyyy' }}</td>
                <td>{{ c.customerName }}</td>
                <td>
                  @switch (c.type) {
                    @case ('reclamo') { <span class="badge badge--red-light">Reclamo</span> }
                    @case ('queja')   { <span class="badge badge--orange-light">Queja</span> }
                  }
                </td>
                <td>
                  @switch (c.status) {
                    @case ('PENDING')    { <span class="badge badge--yellow">Pendiente</span> }
                    @case ('IN_REVIEW')  { <span class="badge badge--blue">En revisión</span> }
                    @case ('RESPONDED')  { <span class="badge badge--green">Respondido</span> }
                    @case ('CLOSED')     { <span class="badge badge--gray">Cerrado</span> }
                  }
                </td>
                <td>
                  <div class="deadline-cell">
                    <span [class.deadline--urgent]="getDays(c) <= 5 && c.status !== 'CLOSED' && c.status !== 'RESPONDED'">
                      {{ c.deadlineAt | date:'dd/MM' }}
                    </span>
                    @if (getDays(c) <= 5 && c.status !== 'CLOSED' && c.status !== 'RESPONDED') {
                      <span class="badge badge--red badge--sm">{{ getDays(c) }}d</span>
                    }
                  </div>
                </td>
              </tr>

              <!-- Fila expandida -->
              @if (expandedId() === c.id) {
                <tr class="expand-row">
                  <td colspan="7" style="padding:0">
                    <div class="expand-content" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="presentation">
                      <div class="expand-grid">
                        <!-- Descripción del cliente -->
                        <div class="expand-col">
                          <h4 class="expand-col__title">Descripción del cliente</h4>
                          <div class="complaint-description">{{ c.description }}</div>
                          @if (c.vendorResponse) {
                            <div class="responded-badge">
                              <span class="material-icons-outlined" style="font-size:16px">check_circle</span>
                              Respuesta enviada el {{ c.createdAt | date:'dd/MM/yyyy' }}
                            </div>
                          }
                        </div>

                        <!-- Textarea respuesta -->
                        <div class="expand-col">
                          <h4 class="expand-col__title">Tu respuesta</h4>
                          @if (c.status === 'RESPONDED' || c.status === 'CLOSED') {
                            <div class="complaint-description">
                              {{ c.vendorResponse ?? 'Sin respuesta registrada' }}
                            </div>
                          } @else {
                            <textarea class="response-textarea"
                              rows="5"
                              placeholder="Escribí tu respuesta al cliente..."
                              [ngModel]="getDraft(c)"
                              (ngModelChange)="setDraft(c.id, $event)"
                            ></textarea>
                            <div class="expand-actions">
                              <button class="btn btn--ghost btn--sm"
                                (click)="onSaveDraft(c)">
                                Guardar borrador
                              </button>
                              <button class="btn btn--primary btn--sm"
                                [disabled]="!getDraft(c)"
                                (click)="onRespond(c)">
                                Enviar respuesta
                              </button>
                            </div>
                          }
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .complaints-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      flex-wrap: wrap; gap: 12px; margin-bottom: 16px;
    }
    .complaints-header__counts { font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .pending-dot {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px; color: #92400E; background: #FEF3C7;
      padding: 2px 10px; border-radius: 99px;
    }
    .indecopi-note {
      font-size: 12px; color: var(--text-muted); background: var(--surface);
      padding: 6px 12px; border-radius: var(--radius); border: 1px solid var(--border);
    }

    .table-wrap { overflow-x: auto; }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th {
      text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .04em; color: var(--text-muted); padding: 10px 14px;
      border-bottom: 2px solid var(--border); white-space: nowrap;
    }
    .table td { padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }

    .complaint-row:hover td { background: var(--surface); }
    .complaint-row--expanded td { background: #FAFAFA; }

    .expand-cell { width: 40px; text-align: center; }
    .expand-icon { font-size: 18px; color: var(--text-muted); transition: transform .2s; }
    .expand-icon.expanded { transform: rotate(90deg); }

    .mono { font-family: monospace; font-size: 12px; }

    /* Badges */
    .badge {
      display: inline-flex; align-items: center; padding: 3px 10px;
      border-radius: 99px; font-size: 12px; font-weight: 500; white-space: nowrap;
    }
    .badge--sm { padding: 2px 7px; font-size: 11px; }
    .badge--yellow     { background: #FEF3C7; color: #92400E; }
    .badge--blue       { background: #DBEAFE; color: #1E40AF; }
    .badge--green      { background: #D1FAE5; color: #065F46; }
    .badge--gray       { background: #F3F4F6; color: #6B7280; }
    .badge--red        { background: #FEE2E2; color: #B91C1C; }
    .badge--red-light  { background: #FEE2E2; color: #991B1B; }
    .badge--orange-light { background: #FEF3C7; color: #92400E; }

    .deadline-cell { display: flex; align-items: center; gap: 6px; }
    .deadline--urgent { color: var(--danger); font-weight: 600; }

    /* Expand content */
    .expand-row { background: #FAFAFA; }
    .expand-content {
      padding: 16px 20px; border-top: 1px solid var(--border);
    }
    .expand-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }
    .expand-col__title {
      font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .04em; color: var(--text-muted); margin: 0 0 10px;
    }
    .complaint-description {
      font-size: 13px; color: var(--text); line-height: 1.6;
      background: #fff; border: 1px solid var(--border); border-radius: var(--radius);
      padding: 12px; min-height: 80px;
    }
    .responded-badge {
      display: flex; align-items: center; gap: 6px; margin-top: 8px;
      font-size: 12px; color: #065F46;
    }

    .response-textarea {
      width: 100%; box-sizing: border-box; padding: 10px 12px;
      border: 1px solid var(--border); border-radius: var(--radius);
      font-size: 13px; font-family: inherit; resize: vertical; line-height: 1.6;
    }
    .response-textarea:focus { outline: none; border-color: var(--primary); }

    .expand-actions {
      display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;
    }

    .btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px;
      border-radius: var(--radius); font-size: 14px; font-weight: 500;
      cursor: pointer; border: none; transition: background .15s;
    }
    .btn--sm { padding: 7px 14px; font-size: 13px; }
    .btn--primary { background: var(--primary); color: #fff; }
    .btn--primary:hover:not(:disabled) { background: var(--primary-dark); }
    .btn--primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn--ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn--ghost:hover { background: var(--surface); }

    .empty-state {
      text-align: center; padding: 64px 24px;
      border: 2px dashed var(--border); border-radius: var(--radius-lg);
    }
    .empty-state__icon { font-size: 48px; color: #D1D5DB; display: block; margin-bottom: 12px; }
    .empty-state__title { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
    .empty-state__sub { font-size: 13px; color: var(--text-muted); margin: 0; }

    @media (max-width: 768px) {
      .expand-grid { grid-template-columns: 1fr; }
    }
  `],
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
