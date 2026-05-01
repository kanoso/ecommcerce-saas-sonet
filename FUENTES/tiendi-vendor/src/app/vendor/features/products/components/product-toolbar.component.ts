import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ProductFilters } from '../products.store';

@Component({
  selector: 'td-product-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="toolbar__search">
        <span class="material-icons-outlined toolbar__search-icon" aria-hidden="true">search</span>
        <input
          class="toolbar__input"
          type="search"
          placeholder="Buscar producto..."
          [value]="filters().search"
          (input)="filtersChange.emit({ search: $any($event.target).value })"
          aria-label="Buscar producto"
        />
      </div>

      <select
        class="toolbar__select"
        [value]="filters().categoryId"
        (change)="filtersChange.emit({ categoryId: $any($event.target).value })"
        aria-label="Filtrar por categoría"
      >
        <option value="">Todas las categorías</option>
        <option value="cat1">Abarrotes</option>
        <option value="cat2">Lácteos</option>
        <option value="cat3">Bebidas</option>
        <option value="cat4">Snacks</option>
        <option value="cat5">Limpieza</option>
        <option value="cat6">Panadería</option>
      </select>

      <select
        class="toolbar__select"
        [value]="filters().stockFilter"
        (change)="filtersChange.emit({ stockFilter: $any($event.target).value })"
        aria-label="Filtrar por stock"
      >
        <option value="all">Todo el stock</option>
        <option value="low">Stock bajo</option>
        <option value="out">Sin stock</option>
        <option value="ok">Stock OK</option>
      </select>

      <div class="toolbar__view-toggle" role="group" aria-label="Modo de vista">
        <button
          class="toolbar__view-btn"
          [class.toolbar__view-btn--active]="viewMode() === 'grid'"
          (click)="viewModeChange.emit('grid')"
          aria-label="Vista cuadrícula"
          [attr.aria-pressed]="viewMode() === 'grid'"
        >
          <span class="material-icons-outlined">grid_view</span>
        </button>
        <button
          class="toolbar__view-btn"
          [class.toolbar__view-btn--active]="viewMode() === 'list'"
          (click)="viewModeChange.emit('list')"
          aria-label="Vista lista"
          [attr.aria-pressed]="viewMode() === 'list'"
        >
          <span class="material-icons-outlined">view_list</span>
        </button>
      </div>

      <div class="toolbar__actions">
        <button class="toolbar__btn toolbar__btn--secondary" (click)="importCsv.emit()" type="button">
          <span class="material-icons-outlined">upload_file</span>
          Importar CSV
        </button>
        <button class="toolbar__btn toolbar__btn--primary" (click)="newProduct.emit()" type="button">
          <span class="material-icons-outlined">add</span>
          Nuevo producto
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
    }

    .toolbar__search {
      position: relative;
      flex: 1;
      min-width: 200px;
    }

    .toolbar__search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      color: var(--text-secondary);
      pointer-events: none;
    }

    .toolbar__input {
      width: 100%;
      padding: 9px 12px 9px 36px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 14px;
      font-family: inherit;
      background: var(--card);
      color: var(--text-primary);
      outline: none;
      box-sizing: border-box;

      &:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-light);
      }
    }

    .toolbar__select {
      padding: 9px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 14px;
      font-family: inherit;
      background: var(--card);
      color: var(--text-primary);
      cursor: pointer;
      outline: none;

      &:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-light);
      }
    }

    .toolbar__view-toggle {
      display: flex;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .toolbar__view-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border: none;
      background: var(--card);
      color: var(--text-secondary);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;

      .material-icons-outlined { font-size: 20px; }

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
      }

      &--active {
        background: var(--primary);
        color: #fff;
      }
    }

    .toolbar__actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .toolbar__btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      border: none;
      border-radius: var(--radius);
      font-size: 14px;
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;

      .material-icons-outlined { font-size: 18px; }

      &--primary {
        background: var(--primary);
        color: #fff;
        &:hover { background: var(--primary-dark); }
      }

      &--secondary {
        background: var(--card);
        color: var(--text-primary);
        border: 1px solid var(--border);
        &:hover { background: var(--surface); }
      }

      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
      }
    }

    @media (max-width: 640px) {
      .toolbar__actions { margin-left: 0; width: 100%; }
      .toolbar__btn { flex: 1; justify-content: center; }
    }
  `],
})
export class ProductToolbarComponent {
  filters = input.required<ProductFilters>();
  viewMode = input.required<string>();

  filtersChange = output<Partial<ProductFilters>>();
  viewModeChange = output<string>();
  newProduct = output<void>();
  importCsv = output<void>();
}
