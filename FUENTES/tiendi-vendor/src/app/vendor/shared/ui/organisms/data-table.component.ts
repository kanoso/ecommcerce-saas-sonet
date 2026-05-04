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
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
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
