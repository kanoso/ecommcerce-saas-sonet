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
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
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
