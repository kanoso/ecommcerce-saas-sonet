import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  forwardRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'td-search-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchBarComponent),
      multi: true,
    },
  ],
  template: `
    <div class="search-bar">
      <span class="material-icons-outlined search-bar__icon" aria-hidden="true">search</span>
      <input
        type="search"
        class="search-bar__input"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onInput($event)"
        aria-label="Buscar"
        [attr.aria-label]="placeholder()"
        autocomplete="off"
      />
      @if (value()) {
        <button
          type="button"
          class="search-bar__clear"
          aria-label="Limpiar búsqueda"
          (click)="onClear()"
        >
          <span class="material-icons-outlined" aria-hidden="true">close</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: border-color 0.15s;

      &:focus-within {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.1);
      }
    }

    .search-bar__icon {
      position: absolute;
      left: 12px;
      color: var(--text-secondary);
      font-size: 18px;
      pointer-events: none;
    }

    .search-bar__input {
      width: 100%;
      padding: 10px 40px 10px 40px;
      border: none;
      background: transparent;
      font-family: inherit;
      font-size: 14px;
      color: var(--text-primary);
      outline: none;
      min-height: 44px;

      &::placeholder {
        color: var(--text-muted);
      }

      /* Remove default search clear button */
      &::-webkit-search-cancel-button { display: none; }
    }

    .search-bar__clear {
      position: absolute;
      right: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      border-radius: 50%;
      cursor: pointer;
      color: var(--text-secondary);
      padding: 0;

      &:hover { background: var(--surface); }
      &:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
      }

      span { font-size: 16px; }
    }
  `],
})
export class SearchBarComponent implements ControlValueAccessor, OnInit {
  placeholder = input<string>('Buscar...');
  debounceMs = input<number>(400);

  searched = output<string>();

  value = signal<string>('');

  private readonly destroyRef = inject(DestroyRef);
  private readonly input$ = new Subject<string>();

  // CVA callbacks — empty stubs required by ControlValueAccessor interface
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onChange: (v: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.input$
      .pipe(
        debounceTime(this.debounceMs()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((term) => {
        this.searched.emit(term);
        this.onChange(term);
      });
  }

  onInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.value.set(term);
    this.onTouched();
    this.input$.next(term);
  }

  onClear(): void {
    this.value.set('');
    this.input$.next('');
  }

  // ControlValueAccessor
  writeValue(val: string): void {
    this.value.set(val ?? '');
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
