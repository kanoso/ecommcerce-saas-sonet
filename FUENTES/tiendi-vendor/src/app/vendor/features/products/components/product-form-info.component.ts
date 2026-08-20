import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  FormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Category, MasterProduct, MasterProductLookupStatus, Product } from '../products.store';
import { normalizeGtin } from '../gtin.util';
import { BarcodeScannerService } from '../../../core/services/barcode-scanner.service';

const CANDIDATE_GTIN_LENGTHS = [8, 12, 13, 14];

/**
 * Validates the GTIN mod-10 check digit live, while the vendor types.
 * GTIN is never mandatory (§7.4), so an empty value is always valid, and a
 * digit sequence shorter than any real GTIN length is treated as "still
 * typing" rather than invalid. See DOCS/CATALOGO_MAESTRO.md §7.5.2.
 */
function gtinCheckDigitValidator(control: AbstractControl): ValidationErrors | null {
  const raw = (control.value ?? '') as string;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (!CANDIDATE_GTIN_LENGTHS.includes(digits.length)) return null;
  return normalizeGtin(digits) ? null : { gtinCheckDigit: true };
}

@Component({
  selector: 'td-product-form-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './product-form-info.component.html',
  styleUrl: './product-form-info.component.scss',
})
export class ProductFormInfoComponent implements OnInit {
  product = input<Partial<Product> | null>(null);
  categories = input.required<Category[]>();
  masterProductLookupStatus = input<MasterProductLookupStatus>('idle');
  masterProductMatch = input<MasterProduct | null>(null);

  formChange = output<Partial<Product>>();
  gtinLookupRequested = output<string>();
  matchConfirmed = output<MasterProduct>();
  matchRejected = output<void>();

  private fb = inject(FormBuilder);
  private scanner = inject(BarcodeScannerService);

  /**
   * Camera-scan state (§7.5.1, "ruta de entrada" Cámara). The `<video>`
   * element stays permanently in the DOM (visibility toggled via CSS class)
   * so `scanVideo()` resolves reliably right after `scanState` flips to
   * 'scanning', instead of racing an `@if`-gated element into existence.
   */
  scanState = signal<'idle' | 'scanning' | 'error'>('idle');
  scanErrorMessage = signal('');
  private scanVideo = viewChild<{ nativeElement: HTMLVideoElement }>('scanVideo');
  private stream: MediaStream | null = null;

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    shortDescription: ['', Validators.maxLength(100)],
    description: [''],
    tags: [''],
    categoryId: ['', Validators.required],
    sku: [''],
    gtin: ['', gtinCheckDigitValidator],
    presentation: [''],
    price: [0, [Validators.required, Validators.min(0.01)]],
    discountPrice: [null as number | null],
    stock: [0, [Validators.required, Validators.min(0)]],
    stockAlert: [5],
    isActive: [true],
    isDailyOffer: [false],
    isFeatured: [false],
  });

  showStockAlert = signal(false);

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((val) => {
        this.formChange.emit(val as Partial<Product>);
        const stock = val.stock ?? 0;
        const alert = val.stockAlert ?? 5;
        this.showStockAlert.set(stock >= 0 && stock < alert);
      });
  }

  ngOnInit(): void {
    const p = this.product();
    if (p) {
      this.form.patchValue({
        name: p.name ?? '',
        shortDescription: p.shortDescription ?? '',
        description: p.description ?? '',
        tags: p.tags ?? '',
        categoryId: p.categoryId ?? '',
        sku: p.sku ?? '',
        gtin: p.gtin ?? '',
        presentation: p.presentation ?? '',
        price: p.price ?? 0,
        discountPrice: p.discountPrice ?? null,
        stock: p.stock ?? 0,
        stockAlert: p.stockAlert ?? 5,
        isActive: p.isActive ?? true,
      });
    }
  }

  isInvalid(field: keyof typeof this.form.controls): boolean {
    const ctrl = this.form.controls[field];
    return ctrl.invalid && ctrl.touched;
  }

  /**
   * Live check-digit indicator for the gtin field — deliberately NOT gated
   * by `touched`. The doc requires this to show while the vendor is still
   * typing, not after saving (§7.5.2).
   */
  gtinCheckDigitInvalid(): boolean {
    return this.form.controls.gtin.hasError('gtinCheckDigit');
  }

  /**
   * Blocks form submission on Enter inside the GTIN field: a USB/Bluetooth
   * scanner gun sends its scanned value followed by an Enter keystroke, and
   * that keystroke must not trigger the form's submit action. When the typed
   * value is a complete, check-digit-valid GTIN, requests a master-catalog
   * lookup instead — the component stays presentational, the page owns the
   * store call. See DOCS/CATALOGO_MAESTRO.md §7.5.1 and §7.5.5.
   */
  onGtinEnter(event: Event): void {
    event.preventDefault();
    this.requestGtinLookup(this.form.controls.gtin.value);
  }

  /**
   * Shared by all three GTIN entry routes (§7.5.1: cámara, teclado,
   * lector USB/Bluetooth). Only requests a master-catalog lookup when the
   * value is a complete, check-digit-valid GTIN — the component stays
   * presentational, the page owns the store call.
   */
  private requestGtinLookup(raw: string): void {
    const digits = raw.replace(/\D/g, '');
    if (!CANDIDATE_GTIN_LENGTHS.includes(digits.length)) return;
    if (!normalizeGtin(digits)) return;

    this.gtinLookupRequested.emit(raw);
  }

  /**
   * Botón "Escanear" (§7.5.1): pide acceso a la cámara, muestra el
   * visor y arranca el polling de frames. Cualquier error (permiso
   * denegado o cámara no disponible) se refleja en `scanErrorMessage`.
   */
  async onScanClick(): Promise<void> {
    this.scanErrorMessage.set('');
    // Set synchronously, before the first `await`, so a plain `.click()` +
    // `detectChanges()` in tests (and the real UI) reflects the scanning
    // state immediately, without waiting on the camera-permission promise.
    this.scanState.set('scanning');
    try {
      this.stream = await this.scanner.requestCameraAccess();

      const video = this.scanVideo()?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
      }

      await this.pollScan();
    } catch (err) {
      this.stopStream();
      this.scanState.set('error');
      this.scanErrorMessage.set(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Sondea frames de video hasta detectar un código o hasta que el
   * vendedor cancele (`scanState` deja de ser 'scanning').
   */
  private async pollScan(): Promise<void> {
    const video = this.scanVideo()?.nativeElement;
    if (!video) return;

    while (this.scanState() === 'scanning') {
      const code = await this.scanner.scanFromVideo(video);
      if (code) {
        this.stopStream();
        this.scanState.set('idle');
        this.form.controls.gtin.setValue(code);
        this.requestGtinLookup(code);
        return;
      }
    }
  }

  /** Botón "Cancelar" del visor: corta la cámara y vuelve a 'idle'. */
  onScanCancel(): void {
    this.stopStream();
    this.scanState.set('idle');
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  /**
   * Vendor confirmed the master-catalog match: autocomplete name and
   * presentation from it, then notify the page so it can clear lookup state.
   * See DOCS/CATALOGO_MAESTRO.md §7.5.5.
   */
  onMatchConfirm(): void {
    const match = this.masterProductMatch();
    if (!match) return;

    this.form.patchValue({
      name: match.name,
      presentation: match.contenido ?? '',
    });
    this.matchConfirmed.emit(match);
  }

  /**
   * Vendor rejected the match (Caso F, §7.5.2): "se limpia el campo y vuelve
   * a empezar" — clear the gtin so the vendor isn't stuck re-triggering the
   * same rejected match on the next Enter, then notify the page to clear
   * lookup state.
   */
  onMatchReject(): void {
    this.form.controls.gtin.setValue('');
    this.matchRejected.emit();
  }
}
