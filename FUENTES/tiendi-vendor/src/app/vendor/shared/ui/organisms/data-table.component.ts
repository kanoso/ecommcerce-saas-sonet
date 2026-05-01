import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  TemplateRef,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { SkeletonComponent } from '../atoms/skeleton.component';
import { EmptyStateComponent } from '../molecules/empty-state.component';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  cellTemplate?: TemplateRef<{ $implicit: T }>;
}

@Component({
  selector: 'td-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NgTemplateOutlet, SkeletonComponent, EmptyStateComponent],
  template: `
    <div class="table-wrapper" role="region" [attr.aria-label]="caption()">
      <table class="data-table">
        <caption class="sr-only">{{ caption() }}</caption>

        <thead>
          <tr>
            @if (selectable()) {
              <th scope="col" class="col-check">
                <input
                  type="checkbox"
                  [checked]="allSelected()"
                  [indeterminate]="someSelected()"
                  (change)="onSelectAll($event)"
                  aria-label="Seleccionar todos"
                />
              </th>
            }
            @for (col of columns(); track col.key) {
              <th
                scope="col"
                [style.width]="col.width ?? 'auto'"
                [class.sortable]="col.sortable"
                (click)="col.sortable && onSort(col)"
                [attr.aria-sort]="col.sortable ? 'none' : null"
              >
                {{ col.header }}
                @if (col.sortable) {
                  <span class="material-icons-outlined sort-icon" aria-hidden="true">unfold_more</span>
                }
              </th>
            }
          </tr>
        </thead>

        <tbody>
          @if (loading()) {
            @for (row of skeletonRows(); track row) {
              <tr class="skeleton-row" aria-hidden="true">
                @if (selectable()) {
                  <td><td-skeleton variant="line" width="20px" height="20px" /></td>
                }
                @for (col of columns(); track col.key) {
                  <td><td-skeleton variant="line" /></td>
                }
              </tr>
            }
          } @else if (data().length === 0) {
            <tr>
              <td [attr.colspan]="colSpan()" class="empty-cell">
                <td-empty-state
                  [title]="emptyMessage()"
                  message="Intentá ajustar los filtros o revisá más tarde."
                  icon="inbox"
                />
              </td>
            </tr>
          } @else {
            @for (row of data(); track trackRow($index, row)) {
              <tr
                [ngClass]="{ 'row-selected': isSelected(row), 'row-clickable': true }"
                (click)="onRowClick(row)"
                (keydown.enter)="onRowClick(row)"
                [attr.tabindex]="0"
                [attr.aria-selected]="selectable() ? isSelected(row) : null"
              >
                @if (selectable()) {
                  <td class="col-check" (click)="$event.stopPropagation()">
                    <input
                      type="checkbox"
                      [checked]="isSelected(row)"
                      (change)="onToggleRow(row)"
                      [attr.aria-label]="'Seleccionar fila ' + ($index + 1)"
                    />
                  </td>
                }

                @for (col of columns(); track col.key) {
                  <td [style.width]="col.width ?? 'auto'">
                    @if (col.cellTemplate) {
                      <ng-container
                        [ngTemplateOutlet]="col.cellTemplate"
                        [ngTemplateOutletContext]="{ $implicit: row }"
                      />
                    } @else {
                      {{ getCellValue(row, col.key) }}
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--card);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;

      caption { display: none; }

      thead tr {
        border-bottom: 1px solid var(--border);
      }

      th {
        padding: 12px 16px;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
        background: var(--surface);

        &.sortable {
          cursor: pointer;
          user-select: none;
          &:hover { color: var(--text-primary); }
        }
      }

      td {
        padding: 14px 16px;
        color: var(--text-primary);
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }

      tbody tr:last-child td { border-bottom: none; }

      .row-clickable {
        cursor: pointer;
        transition: background 0.1s;

        &:hover { background: var(--surface); }
        &:focus-visible { outline: 2px solid var(--secondary); outline-offset: -2px; }
      }

      .row-selected { background: var(--primary-light); }
    }

    .col-check {
      width: 48px;
      padding: 12px 16px;
    }

    .sort-icon {
      font-size: 14px;
      vertical-align: middle;
      margin-left: 4px;
      opacity: 0.5;
    }

    .empty-cell {
      padding: 0 !important;
    }

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--primary);
    }
  `],
})
export class DataTableComponent<T extends object> {
  columns = input<TableColumn<T>[]>([]);
  data = input<T[]>([]);
  loading = input<boolean>(false);
  emptyMessage = input<string>('Sin resultados');
  selectable = input<boolean>(false);
  caption = input<string>('Tabla de datos');
  selected = model<T[]>([]);

  rowClick = output<T>();

  skeletonRows = computed(() => Array.from({ length: 5 }, (_, i) => i));
  allSelected = computed(() =>
    this.data().length > 0 && this.selected().length === this.data().length,
  );
  someSelected = computed(() =>
    this.selected().length > 0 && this.selected().length < this.data().length,
  );
  colSpan = computed(() => this.columns().length + (this.selectable() ? 1 : 0));

  isSelected(row: T): boolean {
    return this.selected().includes(row);
  }

  onSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selected.set(checked ? [...this.data()] : []);
  }

  onToggleRow(row: T): void {
    const current = this.selected();
    if (this.isSelected(row)) {
      this.selected.set(current.filter((r) => r !== row));
    } else {
      this.selected.set([...current, row]);
    }
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  onSort(col: TableColumn<T>): void {
    // Server-side: emit for parent to handle
    this.rowClick.emit({ _sort: col.key } as unknown as T);
  }

  getCellValue(row: T, key: keyof T | string): string {
    const val = (row as Record<string, unknown>)[key as string];
    return val !== undefined && val !== null ? String(val) : '—';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trackRow(index: number, _row: T): number {
    return index;
  }
}
