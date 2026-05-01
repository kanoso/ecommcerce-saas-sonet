import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { Category } from '../products.store';

interface GlobalCategory {
  id: string;
  name: string;
  icon: string;
  subcategories: string[];
  count: number;
}

const GLOBAL_CATEGORIES: GlobalCategory[] = [
  { id: 'cat1', name: 'Abarrotes', icon: 'local_grocery_store', subcategories: ['Arroz', 'Fideos', 'Aceites', 'Conservas'], count: 0 },
  { id: 'cat2', name: 'Lácteos', icon: 'egg_alt', subcategories: ['Leche', 'Yogurt', 'Queso', 'Mantequilla'], count: 0 },
  { id: 'cat3', name: 'Bebidas', icon: 'local_drink', subcategories: ['Agua', 'Gaseosas', 'Jugos', 'Energizantes'], count: 0 },
  { id: 'cat4', name: 'Snacks', icon: 'cookie', subcategories: ['Galletas', 'Papas fritas', 'Chocolates', 'Caramelos'], count: 0 },
  { id: 'cat5', name: 'Limpieza', icon: 'cleaning_services', subcategories: ['Detergente', 'Desinfectante', 'Papel higiénico', 'Jabón'], count: 0 },
  { id: 'cat6', name: 'Panadería', icon: 'bakery_dining', subcategories: ['Pan', 'Tortas', 'Pasteles', 'Muffins'], count: 0 },
];

@Component({
  selector: 'td-product-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="categories">

      <div class="callout" role="note">
        <span class="material-icons-outlined callout__icon" aria-hidden="true">info</span>
        <p class="callout__text">
          Las <strong>categorías globales</strong> son definidas por Tiendi para mantener
          coherencia en el catálogo. Podés agregar subcategorías propias dentro de cada una
          para organizar mejor tus productos.
        </p>
      </div>

      <div class="categories__grid">
        <!-- Árbol de categorías -->
        <div class="categories__tree" aria-label="Categorías globales">
          @for (cat of globalCats; track cat.id) {
            <div class="cat-card" [class.cat-card--expanded]="expandedId() === cat.id">
              <div class="cat-card__header">
                <div class="cat-card__info">
                  <span class="material-icons-outlined cat-card__icon" aria-hidden="true">{{ cat.icon }}</span>
                  <div>
                    <span class="cat-card__name">{{ cat.name }}</span>
                    <span class="cat-card__badge">Global 🌐</span>
                  </div>
                </div>
                <div class="cat-card__actions">
                  <button
                    class="cat-card__btn cat-card__btn--add"
                    (click)="selectedCat.set(cat)"
                    type="button"
                    [attr.aria-label]="'Agregar subcategoría a ' + cat.name"
                  >
                    + Subcategoría
                  </button>
                  <button
                    class="cat-card__btn cat-card__btn--toggle"
                    (click)="toggleExpand(cat.id)"
                    type="button"
                    [attr.aria-label]="(expandedId() === cat.id ? 'Colapsar' : 'Expandir') + ' ' + cat.name"
                    [attr.aria-expanded]="expandedId() === cat.id"
                  >
                    <span class="material-icons-outlined" aria-hidden="true">
                      {{ expandedId() === cat.id ? 'expand_less' : 'expand_more' }}
                    </span>
                  </button>
                </div>
              </div>

              @if (expandedId() === cat.id) {
                <div class="cat-card__subs" role="list" [attr.aria-label]="'Subcategorías de ' + cat.name">
                  @for (sub of cat.subcategories; track sub) {
                    <div class="cat-card__sub" role="listitem">
                      <span class="material-icons-outlined cat-card__sub-icon" aria-hidden="true">subdirectory_arrow_right</span>
                      <span class="cat-card__sub-name">{{ sub }}</span>
                      <span class="cat-card__sub-badge">Global</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Panel derecho -->
        <div class="categories__panel">
          <div class="card">
            <h3 class="card__title">
              <span class="material-icons-outlined" aria-hidden="true">bar_chart</span>
              Resumen
            </h3>
            <div class="stats">
              <div class="stat">
                <span class="stat__value">{{ globalCats.length }}</span>
                <span class="stat__label">Categorías globales</span>
              </div>
              <div class="stat">
                <span class="stat__value">{{ totalSubcategories }}</span>
                <span class="stat__label">Subcategorías disponibles</span>
              </div>
              <div class="stat">
                <span class="stat__value">{{ categories().length }}</span>
                <span class="stat__label">Categorías en uso</span>
              </div>
            </div>
          </div>

          @if (selectedCat()) {
            <div class="card">
              <h3 class="card__title">Nueva subcategoría en <em>{{ selectedCat()!.name }}</em></h3>
              <p class="card__hint">Esta funcionalidad estará disponible próximamente.</p>
              <button class="btn-cancel" (click)="selectedCat.set(null)" type="button">Cancelar</button>
            </div>
          }

          <div class="card card--info">
            <h3 class="card__title">
              <span class="material-icons-outlined" aria-hidden="true">help_outline</span>
              ¿Cómo funcionan las categorías?
            </h3>
            <ul class="info-list">
              <li>Las categorías globales <strong>no pueden modificarse</strong> — son estándares de Tiendi.</li>
              <li>Podés crear <strong>subcategorías propias</strong> dentro de cada categoría global.</li>
              <li>Asignás la categoría a cada producto desde el <strong>formulario de producto</strong>.</li>
              <li>Los compradores filtran tu catálogo por estas categorías.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .categories {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .callout {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: var(--radius-lg);
    }

    .callout__icon {
      font-size: 20px;
      color: #3B82F6;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .callout__text {
      margin: 0;
      font-size: 13px;
      color: #1E40AF;
      line-height: 1.5;
    }

    .categories__grid {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 16px;
      align-items: start;
    }

    .categories__tree {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .cat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: border-color 0.2s;

      &--expanded { border-color: var(--primary); }
    }

    .cat-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      gap: 8px;
    }

    .cat-card__info {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .cat-card__icon {
      font-size: 22px;
      color: var(--primary);
      flex-shrink: 0;
    }

    .cat-card__name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      display: block;
    }

    .cat-card__badge {
      font-size: 11px;
      color: var(--text-secondary);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1px 8px;
    }

    .cat-card__actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .cat-card__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: none;
      border-radius: var(--radius);
      font-size: 12px;
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;

      &:focus-visible { outline: 2px solid var(--secondary); outline-offset: 2px; }

      &--add {
        padding: 6px 12px;
        background: var(--primary-light);
        color: var(--primary);
        &:hover { background: rgba(16, 185, 129, 0.25); }
      }

      &--toggle {
        width: 32px;
        height: 32px;
        background: var(--surface);
        color: var(--text-secondary);
        .material-icons-outlined { font-size: 20px; }
        &:hover { background: var(--border); }
      }
    }

    .cat-card__subs {
      padding: 0 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }

    .cat-card__sub {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: var(--radius);
      background: var(--surface);
    }

    .cat-card__sub-icon {
      font-size: 16px;
      color: var(--text-secondary);
    }

    .cat-card__sub-name {
      font-size: 13px;
      color: var(--text-primary);
      flex: 1;
    }

    .cat-card__sub-badge {
      font-size: 10px;
      color: var(--text-secondary);
      background: var(--border);
      border-radius: 20px;
      padding: 1px 6px;
    }

    .categories__panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: sticky;
      top: 16px;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px;

      &--info {
        background: #F0FDF4;
        border-color: #BBF7D0;
      }
    }

    .card__title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 12px;
      display: flex;
      align-items: center;
      gap: 6px;

      .material-icons-outlined { font-size: 18px; color: var(--primary); }

      em { font-style: normal; color: var(--primary); }
    }

    .card__hint {
      margin: 0 0 12px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .stats {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .stat {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .stat__value {
      font-size: 20px;
      font-weight: 700;
      color: var(--primary);
    }

    .stat__label {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .info-list {
      margin: 0;
      padding: 0 0 0 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;

      li {
        font-size: 13px;
        color: #166534;
        line-height: 1.4;
      }
    }

    .btn-cancel {
      padding: 6px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--card);
      color: var(--text-secondary);
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      &:hover { background: var(--surface); }
    }

    @media (max-width: 900px) {
      .categories__grid { grid-template-columns: 1fr; }
      .categories__panel { position: static; }
    }
  `],
})
export class ProductCategoriesComponent {
  categories = input.required<Category[]>();

  readonly globalCats = GLOBAL_CATEGORIES;
  expandedId = signal<string | null>(null);
  selectedCat = signal<GlobalCategory | null>(null);

  get totalSubcategories(): number {
    return GLOBAL_CATEGORIES.reduce((sum, c) => sum + c.subcategories.length, 0);
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }
}
