import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'td-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <nav
      class="pagination"
      role="navigation"
      aria-label="Paginación"
    >
      <span class="pagination__info" aria-live="polite">
        Mostrando {{ rangeStart() }}-{{ rangeEnd() }} de {{ totalItems() }}
      </span>

      <div class="pagination__controls">
        <button
          type="button"
          class="pagination__btn"
          [disabled]="currentPage() === 1"
          [attr.aria-disabled]="currentPage() === 1"
          aria-label="Página anterior"
          (click)="onPage(currentPage() - 1)"
        >
          <span class="material-icons-outlined" aria-hidden="true">chevron_left</span>
        </button>

        @for (page of visiblePages(); track page) {
          @if (page === -1) {
            <span class="pagination__ellipsis" aria-hidden="true">…</span>
          } @else {
            <button
              type="button"
              class="pagination__btn"
              [ngClass]="{ 'pagination__btn--active': page === currentPage() }"
              [attr.aria-current]="page === currentPage() ? 'page' : null"
              [attr.aria-label]="'Página ' + page"
              (click)="onPage(page)"
            >
              {{ page }}
            </button>
          }
        }

        <button
          type="button"
          class="pagination__btn"
          [disabled]="currentPage() === totalPages()"
          [attr.aria-disabled]="currentPage() === totalPages()"
          aria-label="Página siguiente"
          (click)="onPage(currentPage() + 1)"
        >
          <span class="material-icons-outlined" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    </nav>
  `,
  styles: [`
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 0;
    }

    .pagination__info {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .pagination__controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pagination__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--card);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
      min-height: 44px;
      min-width: 44px;

      &:hover:not(:disabled) {
        border-color: var(--primary);
        color: var(--primary);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
      }

      span.material-icons-outlined { font-size: 18px; }
    }

    .pagination__btn--active {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;

      &:hover { background: var(--primary-dark); border-color: var(--primary-dark); color: #fff; }
    }

    .pagination__ellipsis {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      color: var(--text-secondary);
      font-size: 13px;
    }
  `],
})
export class PaginationComponent {
  currentPage = input.required<number>();
  totalItems = input.required<number>();
  pageSize = input<number>(20);

  pageChange = output<number>();

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));
  rangeStart = computed(() => (this.currentPage() - 1) * this.pageSize() + 1);
  rangeEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.totalItems()));

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (current > 3) pages.push(-1);

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (current < total - 2) pages.push(-1);
    pages.push(total);

    return pages;
  });

  onPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.pageChange.emit(page);
  }
}
