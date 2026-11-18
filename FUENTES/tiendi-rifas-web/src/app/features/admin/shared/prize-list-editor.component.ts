import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';

/** Upper bounds shared with the API (MAX_RAFFLE_PRIZES, MAX_PRIZE_IMAGES). */
export const MAX_PRIZES = 20;
export const MAX_PRIZE_IMAGES = 10;

/** A prize being edited; its position is its place in the list. */
export interface PrizeDraft {
  title: string;
  description: string;
  images: string[];
}

export const emptyPrize = (): PrizeDraft => ({ title: '', description: '', images: [] });

/** True when every prize has a title. */
export const prizesComplete = (prizes: PrizeDraft[]): boolean =>
  prizes.length > 0 && prizes.every((p) => p.title.trim() !== '');

/** The wire shape of the prize list (`premios`). */
export function toPrizeRequests(prizes: PrizeDraft[]) {
  return prizes.map((p) => ({
    titulo: p.title.trim(),
    descripcion: p.description.trim() || null,
    imagenes: p.images,
  }));
}

/**
 * Ordered list of prizes: add, remove, move up and down, each with a title,
 * an optional description and up to 10 images. Prize 1 is drawn first.
 */
@Component({
  selector: 'app-prize-list-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './prize-list-editor.component.scss',
  template: `
    <ol class="prize-list" aria-label="Premios en orden de sorteo">
      @for (prize of prizes(); track $index; let i = $index; let first = $first; let last = $last) {
        <li class="prize-card">
          <div class="prize-card__head">
            <span class="prize-card__position">Premio {{ i + 1 }}</span>
            <div class="prize-card__actions">
              <button
                type="button"
                class="prize-card__btn"
                [attr.data-testid]="'move-prize-up-' + i"
                [disabled]="disabled() || first"
                (click)="move(i, -1)"
                [attr.aria-label]="'Subir premio ' + (i + 1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="prize-card__btn"
                [attr.data-testid]="'move-prize-down-' + i"
                [disabled]="disabled() || last"
                (click)="move(i, 1)"
                [attr.aria-label]="'Bajar premio ' + (i + 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="prize-card__btn prize-card__btn--danger"
                [attr.data-testid]="'remove-prize-' + i"
                [disabled]="disabled() || prizes().length <= 1"
                (click)="remove(i)"
                [attr.aria-label]="'Eliminar premio ' + (i + 1)"
              >
                Eliminar
              </button>
            </div>
          </div>

          <div class="field">
            <label class="field__label" [for]="'premio-titulo-' + i">Título del premio {{ i + 1 }} *</label>
            <input
              class="field__input"
              type="text"
              maxlength="500"
              [id]="'premio-titulo-' + i"
              [value]="prize.title"
              [disabled]="disabled()"
              (input)="update(i, { title: $any($event.target).value })"
              placeholder="Ej: Camioneta 4x4 0km"
            />
          </div>

          <div class="field">
            <label class="field__label" [for]="'premio-descripcion-' + i">Ficha técnica / descripción</label>
            <textarea
              class="field__textarea"
              rows="3"
              maxlength="10000"
              [id]="'premio-descripcion-' + i"
              [value]="prize.description"
              [disabled]="disabled()"
              (input)="update(i, { description: $any($event.target).value })"
            ></textarea>
          </div>

          <div class="field">
            <label class="field__label" [for]="'premio-imagen-' + i">
              Fotos ({{ prize.images.length }}/{{ maxImages }})
            </label>
            <div class="image-input-row">
              <input
                #imageUrl
                class="field__input image-input-row__input"
                type="url"
                [id]="'premio-imagen-' + i"
                [disabled]="disabled()"
                placeholder="https://ejemplo.com/foto-premio.jpg"
                (keydown.enter)="$event.preventDefault(); addImage(i, imageUrl)"
              />
              <button
                type="button"
                class="btn-secondary"
                [disabled]="disabled() || prize.images.length >= maxImages"
                (click)="addImage(i, imageUrl)"
              >
                Agregar foto
              </button>
            </div>
            @if (imageError()?.index === i) {
              <span class="field__error">{{ imageError()?.message }}</span>
            }
            @if (prize.images.length > 0) {
              <div class="thumbs-grid">
                @for (img of prize.images; track $index; let j = $index) {
                  <div class="thumb-card">
                    <img [src]="img" [alt]="'Foto ' + (j + 1) + ' del premio ' + (i + 1)" class="thumb-card__img" />
                    <div class="thumb-card__footer">
                      <span class="thumb-tag">#{{ j + 1 }}</span>
                      <button
                        type="button"
                        class="btn-remove-thumb"
                        [disabled]="disabled()"
                        (click)="removeImage(i, j)"
                        aria-label="Eliminar foto"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </li>
      }
    </ol>

    <button
      type="button"
      class="btn-secondary prize-list__add"
      data-testid="add-prize"
      [disabled]="disabled() || prizes().length >= maxPrizes"
      (click)="add()"
    >
      + Agregar premio ({{ prizes().length }}/{{ maxPrizes }})
    </button>
  `,
})
export class PrizeListEditorComponent {
  readonly prizes = model<PrizeDraft[]>([emptyPrize()]);
  readonly disabled = input(false);

  protected readonly maxPrizes = MAX_PRIZES;
  protected readonly maxImages = MAX_PRIZE_IMAGES;
  protected readonly imageError = signal<{ index: number; message: string } | null>(null);

  add(): void {
    if (this.prizes().length < MAX_PRIZES) {
      this.prizes.update((list) => [...list, emptyPrize()]);
    }
  }

  remove(index: number): void {
    if (this.prizes().length > 1) {
      this.prizes.update((list) => list.filter((_, i) => i !== index));
    }
  }

  move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    this.prizes.update((list) => {
      if (target < 0 || target >= list.length) {
        return list;
      }
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  update(index: number, changes: Partial<PrizeDraft>): void {
    this.prizes.update((list) => list.map((p, i) => (i === index ? { ...p, ...changes } : p)));
  }

  addImage(index: number, field: HTMLInputElement): void {
    const url = field.value.trim();
    this.imageError.set(null);
    if (!url) {
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      this.imageError.set({ index, message: 'La URL de la imagen debe comenzar con http:// o https://' });
      return;
    }
    const prize = this.prizes()[index];
    if (prize.images.length >= MAX_PRIZE_IMAGES) {
      this.imageError.set({ index, message: 'No puedes agregar más de 10 imágenes por premio.' });
      return;
    }
    this.update(index, { images: [...prize.images, url] });
    field.value = '';
  }

  removeImage(index: number, imageIndex: number): void {
    const prize = this.prizes()[index];
    this.update(index, { images: prize.images.filter((_, j) => j !== imageIndex) });
  }
}
