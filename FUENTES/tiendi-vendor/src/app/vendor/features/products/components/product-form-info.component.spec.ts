/**
 * Unit tests for ProductFormInfoComponent — scoped to the `gtin` field added
 * for the barcode-scanning product intake flow. See DOCS/CATALOGO_MAESTRO.md §7.5.
 *
 * Not a full-coverage spec for the whole form: only the gtin-related behavior
 * (form control, precarga on edit, and Enter-key interception to support a
 * USB/Bluetooth scanner gun) is covered here.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProductFormInfoComponent } from './product-form-info.component';
import { Category, Product } from '../products.store';
import {
  BarcodeScannerService,
  CameraPermissionDeniedError,
} from '../../../core/services/barcode-scanner.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCategories(): Category[] {
  return [{ id: 'cat-1', name: 'Bebidas', slug: 'bebidas' }];
}

async function createFixture(
  product: Partial<Product> | null = null,
  scanner?: Partial<BarcodeScannerService>,
): Promise<ComponentFixture<ProductFormInfoComponent>> {
  await TestBed.configureTestingModule({
    imports: [ProductFormInfoComponent],
    providers: [
      provideZonelessChangeDetection(),
      ...(scanner ? [{ provide: BarcodeScannerService, useValue: scanner }] : []),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ProductFormInfoComponent);
  fixture.componentRef.setInput('product', product);
  fixture.componentRef.setInput('categories', makeCategories());
  fixture.detectChanges();
  return fixture;
}

function gtinInput(fixture: ComponentFixture<ProductFormInfoComponent>): HTMLInputElement | null {
  return fixture.nativeElement.querySelector('#gtin');
}

function makeFakeStream(): MediaStream {
  const track = { stop: vi.fn() };
  return { getTracks: () => [track] } as unknown as MediaStream;
}

function makeScannerMock(overrides: {
  requestCameraAccess?: ReturnType<typeof vi.fn>;
  scanFromVideo?: ReturnType<typeof vi.fn>;
} = {}): Partial<BarcodeScannerService> {
  return {
    requestCameraAccess:
      overrides.requestCameraAccess ?? vi.fn().mockResolvedValue(makeFakeStream()),
    // Never resolves by default: tests that don't care about the scan
    // outcome must not hang waiting for a fabricated barcode.
    scanFromVideo: overrides.scanFromVideo ?? vi.fn(() => new Promise<string | null>(() => {})),
    isSupported: vi.fn().mockResolvedValue(true),
  } as unknown as Partial<BarcodeScannerService>;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProductFormInfoComponent — gtin', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should have a gtin control defaulting to an empty string', async () => {
    const fixture = await createFixture();
    expect(fixture.componentRef.instance.form.controls.gtin.value).toBe('');
  });

  it('should preload gtin from the product on edit', async () => {
    const fixture = await createFixture({ gtin: '7750182001234' } as Partial<Product>);
    expect(fixture.componentRef.instance.form.controls.gtin.value).toBe('7750182001234');
  });

  it('should default gtin to an empty string when editing a product without one', async () => {
    const fixture = await createFixture({ name: 'Agua San Luis' } as Partial<Product>);
    expect(fixture.componentRef.instance.form.controls.gtin.value).toBe('');
  });

  it('should render a gtin input next to the sku field', async () => {
    const fixture = await createFixture();
    expect(gtinInput(fixture)).not.toBeNull();
  });

  it('should not submit the form when Enter is pressed on the gtin input', async () => {
    const fixture = await createFixture();
    const input = gtinInput(fixture);
    expect(input).not.toBeNull();

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    input!.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
  });

  // ─── Live check-digit validation (§7.5.2) ─────────────────────────────────
  // Must fire while typing — never gated behind `touched`/blur/submit.

  it('should not flag a gtin with a valid check digit', async () => {
    const fixture = await createFixture();
    const input = gtinInput(fixture)!;

    input.value = '7750182001236';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentRef.instance.form.controls.gtin.valid).toBe(true);
    expect(fixture.nativeElement.querySelector('#gtin-error')).toBeNull();
  });

  it('should flag a gtin with an invalid check digit without requiring the field to be touched', async () => {
    const fixture = await createFixture();
    const input = gtinInput(fixture)!;

    input.value = '7750182001237';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentRef.instance.form.controls.gtin.touched).toBe(false);
    expect(fixture.componentRef.instance.form.controls.gtin.hasError('gtinCheckDigit')).toBe(true);
    expect(fixture.nativeElement.querySelector('#gtin-error')).not.toBeNull();
  });

  it('should not flag an incomplete gtin while the vendor is still typing', async () => {
    const fixture = await createFixture();
    const input = gtinInput(fixture)!;

    input.value = '775018';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentRef.instance.form.controls.gtin.hasError('gtinCheckDigit')).toBe(false);
    expect(fixture.nativeElement.querySelector('#gtin-error')).toBeNull();
  });

  it('should not flag an empty gtin (the field is optional — §7.4)', async () => {
    const fixture = await createFixture();
    expect(fixture.componentRef.instance.form.controls.gtin.hasError('gtinCheckDigit')).toBe(false);
    expect(fixture.nativeElement.querySelector('#gtin-error')).toBeNull();
  });

  // ─── Master-catalog lookup trigger (§7.5.5) ───────────────────────────────
  // Enter on a complete, check-digit-valid gtin requests a lookup; the
  // component stays presentational — it only emits, the page owns the store.

  function pressEnter(input: HTMLInputElement): void {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
  }

  it('should emit gtinLookupRequested when Enter is pressed on a complete, valid gtin', async () => {
    const fixture = await createFixture();
    const spy = vi.fn();
    fixture.componentRef.instance.gtinLookupRequested.subscribe(spy);
    const input = gtinInput(fixture)!;

    input.value = '7750182001236';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    pressEnter(input);
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith('7750182001236');
  });

  it('should not emit gtinLookupRequested when Enter is pressed on an invalid check digit', async () => {
    const fixture = await createFixture();
    const spy = vi.fn();
    fixture.componentRef.instance.gtinLookupRequested.subscribe(spy);
    const input = gtinInput(fixture)!;

    input.value = '7750182001237';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    pressEnter(input);
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should not emit gtinLookupRequested when Enter is pressed on an incomplete gtin', async () => {
    const fixture = await createFixture();
    const spy = vi.fn();
    fixture.componentRef.instance.gtinLookupRequested.subscribe(spy);
    const input = gtinInput(fixture)!;

    input.value = '775018';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    pressEnter(input);
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  // ─── Match-confirmation banner (§7.5.2) ───────────────────────────────────

  const MATCH = {
    gtin: '7750182001236',
    name: 'Agua San Luis',
    marca: 'San Luis',
    contenido: '625 ml',
    categoria: 'Bebidas',
    imagen: 'https://cdn.tiendi.pe/master/agua-san-luis.jpg',
  };

  it('should render the match-confirmation banner with the exact required copy when a match is found', async () => {
    const fixture = await createFixture();
    fixture.componentRef.setInput('masterProductLookupStatus', 'found');
    fixture.componentRef.setInput('masterProductMatch', MATCH);
    fixture.detectChanges();

    const found = fixture.nativeElement.querySelector('.master-match__found');
    const question = fixture.nativeElement.querySelector('.master-match__question');
    expect(found?.textContent?.trim()).toBe('Encontramos: Agua San Luis 625 ml');
    expect(question?.textContent?.trim()).toBe('¿Es tu producto?');
    expect(fixture.nativeElement.querySelector('.master-match__confirm')?.textContent?.trim()).toBe('Sí');
    expect(fixture.nativeElement.querySelector('.master-match__reject')?.textContent?.trim()).toBe(
      'No, corregir',
    );
  });

  it('should not render the banner when the lookup status is not "found"', async () => {
    const fixture = await createFixture();
    fixture.componentRef.setInput('masterProductLookupStatus', 'loading');
    fixture.componentRef.setInput('masterProductMatch', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.master-match__found')).toBeNull();
  });

  it('should patch name and presentation from the match and emit matchConfirmed when "Sí" is clicked', async () => {
    const fixture = await createFixture();
    const spy = vi.fn();
    fixture.componentRef.instance.matchConfirmed.subscribe(spy);
    fixture.componentRef.setInput('masterProductLookupStatus', 'found');
    fixture.componentRef.setInput('masterProductMatch', MATCH);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.master-match__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentRef.instance.form.controls.name.value).toBe('Agua San Luis');
    expect(fixture.componentRef.instance.form.controls.presentation.value).toBe('625 ml');
    expect(spy).toHaveBeenCalledWith(MATCH);
  });

  it('should emit matchRejected without touching name/presentation when "No, corregir" is clicked', async () => {
    const fixture = await createFixture();
    const spy = vi.fn();
    fixture.componentRef.instance.matchRejected.subscribe(spy);
    fixture.componentRef.setInput('masterProductLookupStatus', 'found');
    fixture.componentRef.setInput('masterProductMatch', MATCH);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.master-match__reject') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentRef.instance.form.controls.name.value).toBe('');
    expect(spy).toHaveBeenCalled();
  });

  // Caso F (§7.5.2): "Si el vendedor responde que no, se limpia el campo y
  // vuelve a empezar" — the gtin field itself must be cleared, so the vendor
  // isn't stuck re-triggering the same rejected match on the next Enter.
  it('should clear the gtin field when "No, corregir" is clicked (Caso F)', async () => {
    const fixture = await createFixture();
    fixture.componentRef.setInput('masterProductLookupStatus', 'found');
    fixture.componentRef.setInput('masterProductMatch', MATCH);
    fixture.componentRef.instance.form.controls.gtin.setValue(MATCH.gtin);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.master-match__reject') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentRef.instance.form.controls.gtin.value).toBe('');
  });
});

// ─── Camera scan (§7.5.1 — "Tres rutas de entrada del GTIN") ────────────────
// The "Escanear" button is one of three equivalent ways to fill the gtin
// field (camera, keyboard, USB/Bluetooth gun). A successful scan must go
// through the same gtinLookupRequested pipeline as onGtinEnter.

describe('ProductFormInfoComponent — camera scan (§7.5.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should render an "Escanear" button next to the gtin field', async () => {
    const fixture = await createFixture();

    const btn = fixture.nativeElement.querySelector('.field__scan-btn');
    expect(btn?.textContent?.trim()).toContain('Escanear');
  });

  it('should request camera access and show the scanner viewfinder when "Escanear" is clicked', async () => {
    const requestCameraAccess = vi.fn().mockResolvedValue(makeFakeStream());
    const fixture = await createFixture(null, makeScannerMock({ requestCameraAccess }));
    const btn = fixture.nativeElement.querySelector('.field__scan-btn') as HTMLButtonElement;

    btn.click();
    fixture.detectChanges();

    expect(requestCameraAccess).toHaveBeenCalled();
    expect(fixture.componentRef.instance.scanState()).toBe('scanning');
    expect(fixture.nativeElement.querySelector('.scanner.scanner--hidden')).toBeNull();
  });

  it('should set the gtin field and emit gtinLookupRequested when a scan succeeds', async () => {
    const scanFromVideo = vi.fn().mockResolvedValue('7750182001236');
    const fixture = await createFixture(null, makeScannerMock({ scanFromVideo }));
    const spy = vi.fn();
    fixture.componentRef.instance.gtinLookupRequested.subscribe(spy);

    await fixture.componentRef.instance.onScanClick();
    fixture.detectChanges();

    expect(fixture.componentRef.instance.form.controls.gtin.value).toBe('7750182001236');
    expect(spy).toHaveBeenCalledWith('7750182001236');
    expect(fixture.componentRef.instance.scanState()).toBe('idle');
  });

  it('should show the camera-permission-denied message when access is refused', async () => {
    const requestCameraAccess = vi.fn().mockRejectedValue(new CameraPermissionDeniedError());
    const fixture = await createFixture(null, makeScannerMock({ requestCameraAccess }));

    await fixture.componentRef.instance.onScanClick();
    fixture.detectChanges();

    expect(fixture.componentRef.instance.scanState()).toBe('error');
    const error = fixture.nativeElement.querySelector('.scanner__error');
    expect(error?.textContent).toMatch(/permiso de c[aá]mara/i);
  });

  it('should stop the camera stream and hide the viewfinder when "Cancelar" is clicked mid-scan', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const requestCameraAccess = vi.fn().mockResolvedValue(stream);
    const fixture = await createFixture(null, makeScannerMock({ requestCameraAccess }));
    const btn = fixture.nativeElement.querySelector('.field__scan-btn') as HTMLButtonElement;

    btn.click();
    await flushMicrotasks();
    fixture.detectChanges();

    const cancelBtn = fixture.nativeElement.querySelector('.scanner__cancel') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    cancelBtn.click();
    fixture.detectChanges();

    expect(track.stop).toHaveBeenCalled();
    expect(fixture.componentRef.instance.scanState()).toBe('idle');
    expect(fixture.nativeElement.querySelector('.scanner.scanner--hidden')).not.toBeNull();
  });
});
